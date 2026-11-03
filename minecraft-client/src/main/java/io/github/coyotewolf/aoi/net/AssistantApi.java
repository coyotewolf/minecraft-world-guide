package io.github.coyotewolf.aoi.net;

import com.google.gson.*;
import io.github.coyotewolf.aoi.model.Models;
import io.github.coyotewolf.aoi.model.Models.*;
import io.github.coyotewolf.aoi.security.SessionManager;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CancellationException;

public final class AssistantApi {
 private final String worker,supabase,key;
 private final Transport transport;
 public final SessionManager sessions;
 public AssistantApi(String worker,String supabase,String key,SessionManager sessions,Transport transport){
  this.worker=base(worker);this.supabase=base(supabase);this.key=key;this.sessions=sessions;this.transport=transport;
 }
 private static String base(String url){URI u=URI.create(url);if(!"https".equals(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null||u.getQuery()!=null||u.getFragment()!=null)throw new IllegalArgumentException("服務網址必須是 HTTPS。");return url.replaceAll("/+$","");}
 private JsonElement call(String method,String url,JsonElement body,Map<String,String> headers,int timeout){
  Transport.Reply r=transport.request(method,URI.create(url),headers,body,timeout);
  if(r.status()<200||r.status()>=300){
   JsonObject o=r.body().isJsonObject()?r.body().getAsJsonObject():new JsonObject();
   String fallback=switch(r.status()){case 401->"登入已過期，請重新登入。";case 403->"帳號未核可或遊戲端尚未開放，請聯絡管理員。";case 409->"資料已變更，請重新整理。";case 429->"免費額度或頻率限制，請稍後重試。";case 503->"小助手暫時無法回覆，請稍後重試。";default->"連線失敗（"+r.status()+"），請重試。";};
   String retry=Models.text(o,"retryAt","");
   if(o.has("retryAt")&&o.get("retryAt").isJsonPrimitive()&&o.getAsJsonPrimitive("retryAt").isNumber()){
    try{retry=java.time.format.DateTimeFormatter.ofPattern("MM-dd HH:mm").withZone(java.time.ZoneId.of("Asia/Singapore")).format(Instant.ofEpochMilli(o.get("retryAt").getAsLong()));}catch(Exception ignored){}
   }
   throw new ApiException(r.status(),Models.text(o,"error",fallback),retry);
  }
  return r.body();
 }
 private Map<String,String> publicHeaders(){return new HashMap<>(Map.of("apikey",key,"x-public-key",key));}
 public void login(String gameId,String password){
  long generation=sessions.generation();
  JsonObject o=call("POST",supabase+"/functions/v1/player-auth",Models.obj("action","login","gameId",gameId.trim(),"password",password),publicHeaders(),20).getAsJsonObject();
  if(!o.has("session")||!o.get("session").isJsonObject())throw new ApiException(401,"登入失敗，請確認網站帳號與專用密碼。","");
  sessions.install(o.getAsJsonObject("session"),generation);
  try{active();}catch(RuntimeException e){sessions.clear();throw e;}
 }
 public void logout(){
  var s=sessions.get();sessions.clear();
  if(s!=null)try{call("POST",supabase+"/auth/v1/logout?scope=local",null,Map.of("apikey",key,"Authorization","Bearer "+s.accessToken),15);}catch(RuntimeException ignored){}
 }
 private SessionManager.Session token(boolean force){
  var s=sessions.get();if(s==null)throw new ApiException(401,"請先登入網站帳號。","");
  if(force||s.expiresAt<Instant.now().getEpochSecond()+120){
   long epoch=sessions.generation();
   try{
    JsonObject r=call("POST",supabase+"/auth/v1/token?grant_type=refresh_token",Models.obj("refresh_token",s.refreshToken),Map.of("apikey",key),20).getAsJsonObject();
    sessions.install(r,epoch);s=sessions.get();
   }catch(ApiException e){if(e.status==400||e.status==401||e.status==403)sessions.clear();throw e;}
  }
  return s;
 }
 private JsonElement auth(String method,String url,JsonElement body,String prefer,int timeout){
  long generation=sessions.generation();
  for(int attempt=0;attempt<2;attempt++){
   var s=token(attempt==1);var headers=new HashMap<>(Map.of("Authorization","Bearer "+s.accessToken,"apikey",key));
   if(prefer!=null)headers.put("Prefer",prefer);
   if(generation!=sessions.generation())throw new CancellationException();
   try{return call(method,url,body,headers,timeout);}
   catch(ApiException e){if(e.status==401&&attempt==0)continue;if(e.status==401||e.status==403)sessions.clear();throw e;}
  }
  throw new ApiException(401,"請重新登入。","");
 }
 public String owner(){return token(false).userId;}
 public void active(){
  var o=auth("POST",supabase+"/rest/v1/rpc/player_status",new JsonObject(),null,15).getAsJsonObject();
  if(!o.has("active")||!o.get("active").getAsBoolean()){sessions.clear();throw new ApiException(403,"帳號尚未核可或已停用，請聯絡管理員。","");}
 }
 public JsonObject status(){return auth("GET",worker+"/status",null,null,15).getAsJsonObject();}
 public Answer ask(String question,String cid,String requestId){return ask(question,cid,requestId,new JsonObject());}
 private java.util.function.Supplier<String> biomeHandler;
 public void biomeHandler(java.util.function.Supplier<String> handler){biomeHandler=handler;}
 private java.util.function.Function<io.github.coyotewolf.aoi.model.RegistryQuery,String> registryHandler;
 public void registryHandler(java.util.function.Function<io.github.coyotewolf.aoi.model.RegistryQuery,String> handler){registryHandler=handler;}
 private java.util.function.Function<io.github.coyotewolf.aoi.model.NearbyQuery,String> searchHandler;
 public void searchHandler(java.util.function.Function<io.github.coyotewolf.aoi.model.NearbyQuery,String> handler){searchHandler=handler;}
 public Answer ask(String question,String cid,String requestId,JsonObject context){
  var deferred=context.has("playerContext")&&context.get("playerContext").isJsonObject()?context.getAsJsonObject("playerContext").deepCopy():Models.obj("version",new JsonPrimitive(1),"unavailable",new JsonArray());context=context.deepCopy();context.remove("playerContext");
  boolean localSearch=false,registryEnabled=false,biomeEnabled=false,contextEnabled=false;
  if(context.size()>0||searchHandler!=null||registryHandler!=null||biomeHandler!=null){var capabilities=status();if(context.size()>0&&(!capabilities.has("gameContextVersion")||capabilities.get("gameContextVersion").getAsInt()<1))throw new ApiException(503,"雲端尚未支援畫面資訊，請先更新雲端服務。","");localSearch=searchHandler!=null&&capabilities.has("localSearchVersion")&&capabilities.get("localSearchVersion").getAsInt()==1;registryEnabled=registryHandler!=null&&capabilities.has("registryLookupVersion")&&capabilities.get("registryLookupVersion").getAsInt()==1;biomeEnabled=biomeHandler!=null&&capabilities.has("currentBiomeVersion")&&capabilities.get("currentBiomeVersion").getAsInt()==1;contextEnabled=capabilities.has("playerContextVersion")&&capabilities.get("playerContextVersion").getAsInt()==1;}
  if(question==null||question.isBlank()||question.length()>600)throw new ApiException(400,"請輸入 1～600 字的問題。","");
  var body=Models.obj("question",question.trim(),"conversationId",Models.uuid(cid),"requestId",Models.uuid(requestId),"gameContext",context);if(localSearch)body.addProperty("clientSearchVersion",1);if(registryEnabled)body.addProperty("clientRegistryVersion",1);if(biomeEnabled)body.addProperty("clientBiomeVersion",1);if(contextEnabled)body.addProperty("clientContextVersion",1);
  var response=auth("POST",worker+"/ask",body,null,90).getAsJsonObject();
  if(response.has("clientAction")&&response.get("clientAction").isJsonObject()&&"player_context".equals(Models.text(response.getAsJsonObject("clientAction"),"type",""))){
   var action=response.getAsJsonObject("clientAction");if(!contextEnabled||!action.keySet().equals(java.util.Set.of("version","type","token"))||!action.get("version").isJsonPrimitive()||!action.getAsJsonPrimitive("version").isNumber()||action.get("version").getAsDouble()!=1)throw new ApiException(503,"不支援的補充資訊請求。","");
   body.addProperty("contextToken",Models.uuid(Models.text(action,"token","")));body.add("playerContext",deferred);
   return Models.answer(auth("POST",worker+"/ask",body,null,90).getAsJsonObject());
  }
  if(response.has("clientAction")){
   if(!response.get("clientAction").isJsonObject())throw new ApiException(503,"雲端回傳了不支援的本機操作。","");
   if("current_biome".equals(Models.text(response.getAsJsonObject("clientAction"),"type",""))){if(!biomeEnabled)throw new ApiException(503,"不支援生態域查詢。","");io.github.coyotewolf.aoi.model.BiomeResult.validateAction(response.getAsJsonObject("clientAction"));return new Answer(biomeHandler.get(),new JsonArray());}
   if("registry_id".equals(Models.text(response.getAsJsonObject("clientAction"),"type",""))){if(!registryEnabled)throw new ApiException(503,"不支援ID查詢。","");return new Answer(registryHandler.apply(io.github.coyotewolf.aoi.model.RegistryQuery.action(response.getAsJsonObject("clientAction"))),new JsonArray());}
   if(!localSearch)throw new ApiException(503,"不支援附近查詢。","");
   var query=io.github.coyotewolf.aoi.model.NearbyQuery.action(response.getAsJsonObject("clientAction"));return new Answer(searchHandler.apply(query),new JsonArray());
  }
  return Models.answer(response);
 }
 public void forget(String cid){auth("POST",worker+"/forget",Models.obj("conversationId",Models.uuid(cid)),null,20);}
 public boolean messageExists(String cid,String mid){return auth("GET",table("assistant_messages","conversation_id=eq."+Models.uuid(cid)+"&id=eq."+Models.uuid(mid)+"&select=id&limit=1"),null,null,15).getAsJsonArray().size()>0;}
 private static String enc(String s){return URLEncoder.encode(s,StandardCharsets.UTF_8);}
 private String table(String table,String query){return supabase+"/rest/v1/"+table+"?user_id=eq."+owner()+"&"+query;}
 public boolean exists(String cid){return auth("GET",table("assistant_conversations","id=eq."+Models.uuid(cid)+"&select=id&limit=1"),null,null,15).getAsJsonArray().size()>0;}
 public void ensure(String cid,String title,boolean known){
  if(exists(cid))return;
  active();
  if(known)throw new ApiException(410,"這段對話已被刪除，請開始新對話。","");
  JsonObject row=Models.obj("id",cid,"user_id",owner(),"title",Models.safe(title,79));
  try{auth("POST",table("assistant_conversations","select=id"),row,"return=representation",15);}
  catch(ApiException e){if(e.status!=409||!exists(cid))throw e;}
 }
 public Page<Conversation> conversations(Conversation cursor){
  String query="select=id,title,updated_at&order=updated_at.desc,id.desc&limit=30";
  if(cursor!=null)query+="&or="+enc("(updated_at.lt."+cursor.updatedAt()+",and(updated_at.eq."+cursor.updatedAt()+",id.lt."+Models.uuid(cursor.id())+"))");
  var a=auth("GET",table("assistant_conversations",query),null,null,15).getAsJsonArray();var list=new ArrayList<Conversation>();
  for(var v:a){var o=v.getAsJsonObject();String at=Models.text(o,"updated_at","");Instant.parse(at);list.add(new Conversation(Models.uuid(Models.text(o,"id",null)),Models.safe(Models.text(o,"title","新對話"),80),at));}
  return new Page<>(List.copyOf(list),a.size()==30);
 }
 public Page<Message> messages(String cid,Message before){
  String query="conversation_id=eq."+Models.uuid(cid)+"&select=id,conversation_id,role,text,facts,created_at&order=created_at.desc,id.desc&limit=30";
  if(before!=null)query+="&or="+enc("(created_at.lt."+before.createdAt()+",and(created_at.eq."+before.createdAt()+",id.lt."+Models.uuid(before.id())+"))");
  var a=auth("GET",table("assistant_messages",query),null,null,15).getAsJsonArray();var list=new ArrayList<Message>();
  for(var v:a){Message m=Models.message(v.getAsJsonObject());if(!m.conversationId().equals(cid))throw new IllegalArgumentException("訊息對話不符。");list.add(m);}
  list.sort(Models.MESSAGE_ORDER);return new Page<>(List.copyOf(list),a.size()==30);
 }
 public void put(Message m){
  if(!exists(m.conversationId())){active();throw new ApiException(410,"對話已刪除，未同步訊息不會重新上傳。","");}
  String q="id=eq."+Models.uuid(m.id())+"&conversation_id=eq."+Models.uuid(m.conversationId())+"&select=id,conversation_id,role,text,facts,created_at";
  try{auth("POST",table("assistant_messages","select=id"),m.row(owner()),"return=representation",15);}
  catch(ApiException e){
   if(e.status!=409)throw e;
   var rows=auth("GET",table("assistant_messages",q),null,null,15).getAsJsonArray();
   if(rows.size()!=1)throw e;
   Message saved=Models.message(rows.get(0).getAsJsonObject());
   if(!saved.role().equals(m.role())||!saved.text().equals(m.text())||!saved.facts().equals(m.facts()))throw new ApiException(409,"同一訊息的雲端內容不符，請重新整理。","");
  }
  // Failure here is retryable using the same message UUID.
  rename(m.conversationId(),null);
 }
 public void rename(String cid,String title){
  var row=Models.obj("updated_at",Instant.now().toString());if(title!=null)row.addProperty("title",title.isBlank()?"新對話":Models.safe(title,79));
  var rows=auth("PATCH",table("assistant_conversations","id=eq."+Models.uuid(cid)+"&select=id"),row,"return=representation",15).getAsJsonArray();
  if(rows.size()!=1){active();throw new ApiException(410,"對話已被刪除，請開始新對話。","");}
 }
 public void delete(String cid,String messageId){
  String table=messageId==null?"assistant_conversations":"assistant_messages";
  String query="id=eq."+Models.uuid(messageId==null?cid:messageId)+"&select=id"+(messageId==null?"":"&conversation_id=eq."+Models.uuid(cid));
  var rows=auth("DELETE",table(table,query),null,"return=representation",15).getAsJsonArray();
  if(rows.size()==0){active();var remain=auth("GET",table(table,query),null,null,15).getAsJsonArray();if(remain.size()!=0)throw new ApiException(409,"刪除未完成，請重試。","");}
 }
}
