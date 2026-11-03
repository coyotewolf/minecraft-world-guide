package io.github.coyotewolf.aoichecks;

import com.google.gson.*;
import io.github.coyotewolf.aoi.model.Models;
import io.github.coyotewolf.aoi.model.Models.*;
import io.github.coyotewolf.aoi.net.*;
import io.github.coyotewolf.aoi.security.SessionManager;
import io.github.coyotewolf.aoi.sync.ChatSyncService;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CancellationException;

public final class ClientChecks {
 public static final String OWNER="00000000-0000-4000-8000-000000000001",OTHER="00000000-0000-4000-8000-000000000002";
 private static int checks;
 public static void require(boolean ok,String label){if(!ok)throw new AssertionError(label);checks++;System.out.println("PASS "+label);}
 private static void fails(Runnable action,int status){try{action.run();throw new AssertionError("expected failure "+status);}catch(ApiException e){require(e.status==status,"expected HTTP "+status);}}
 public static final class Fake implements Transport {
  public final Map<String,JsonObject> conversations=new LinkedHashMap<>(),messages=new LinkedHashMap<>();
  public final Map<String,JsonObject> answers=new HashMap<>();
  public final List<String> requestIds=new ArrayList<>(),operations=new ArrayList<>();
  public final List<String> questions=new ArrayList<>();
  public final List<JsonObject> contexts=new ArrayList<>();
  public boolean locate,active=true,loseAnswer,failAssistantWrite,failDelete,expireOnce,failForget;
  public int generated,refreshes;
  public Runnable onAsk=()->{};
  private Reply ok(JsonElement body){return new Reply(200,body);}
  private Reply error(int status){return new Reply(status,Models.obj("error","simulated "+status,"retryAt",Instant.now().plusSeconds(60).toString()));}
  public JsonObject session(){return Models.obj("access_token","mock-token","refresh_token",refreshes==0?"mock-refresh":"mock-refresh-"+refreshes,"expires_at",String.valueOf(Instant.now().getEpochSecond()+3600),"user",Models.obj("id",OWNER));}
  public void seed(String cid,String title,String owner){conversations.put(cid,Models.obj("id",cid,"title",title,"user_id",owner,"updated_at","2026-10-09T00:00:00Z"));}
  public void seedMessage(String cid,String role,String text,String at){String id=Models.id();messages.put(id,new Message(id,cid,role,text,new JsonArray(),at,true).row(OWNER));}
  @Override public Reply request(String method,URI uri,Map<String,String> headers,JsonElement body,int timeout){
   String path=uri.getPath();operations.add(method+" "+path);
   if(path.endsWith("player-auth"))return ok(Models.obj("session",session(),"approved",active));
   if(path.endsWith("/token")){refreshes++;return ok(session());}
   if(path.endsWith("/logout"))return ok(JsonNull.INSTANCE);
   if(!"Bearer mock-token".equals(headers.get("Authorization")))return error(401);
   require(!headers.containsKey("Origin"),"native requests do not spoof Origin");
   if(expireOnce){expireOnce=false;return error(401);}
   if(path.endsWith("/player_status"))return ok(Models.obj("active",active));
   if(!active)return error(403);
   if(path.equals("/status"))return ok(Models.obj("gameContextVersion",1,"localSearchVersion",1));
   if(path.equals("/forget"))return failForget?error(503):ok(Models.obj("ok",true));
   if(path.equals("/ask")){
    var input=body.getAsJsonObject();String rid=input.get("requestId").getAsString();requestIds.add(rid);questions.add(input.get("question").getAsString());contexts.add(input.getAsJsonObject("gameContext").deepCopy());
    JsonObject answer=answers.get(rid);if(answer==null){generated++;answer=Models.obj("answer","測試回答：取得材料後再嘗試。","facts",new JsonArray());answers.put(rid,answer);}
    onAsk.run();if(locate)return ok(Models.obj("clientAction",Models.obj("version",new com.google.gson.JsonPrimitive(1),"type","nearby_entities","query","虛顎龍","radius",new com.google.gson.JsonPrimitive(0))));if(loseAnswer){loseAnswer=false;throw new ApiException(0,"回覆遺失","");}return ok(answer.deepCopy());
   }
   boolean convo=path.endsWith("assistant_conversations");var table=convo?conversations:messages;
   var q=new HashMap<String,String>();for(String part:uri.getRawQuery().split("&")){String[] p=part.split("=",2);q.put(p[0],URLDecoder.decode(p.length==2?p[1]:"",StandardCharsets.UTF_8));}
   require(q.get("user_id").equals("eq."+OWNER),"all REST access filters authenticated owner");
   var rows=new ArrayList<JsonObject>();
   for(var row:table.values())if(row.get("user_id").getAsString().equals(OWNER)&&q.entrySet().stream().filter(e->e.getValue().startsWith("eq.")).allMatch(e->row.has(e.getKey())&&row.get(e.getKey()).getAsString().equals(e.getValue().substring(3))))rows.add(row);
   if(method.equals("POST")){
    var row=body.getAsJsonObject();String id=row.get("id").getAsString();if(table.containsKey(id))return error(409);
    if(!convo&&failAssistantWrite&&row.get("role").getAsString().equals("assistant")){failAssistantWrite=false;return error(503);}
    var saved=row.deepCopy();if(convo&&!saved.has("updated_at"))saved.addProperty("updated_at",Instant.now().toString());table.put(id,saved);return ok(array(List.of(saved)));
   }
   if(method.equals("PATCH")){for(var row:rows)body.getAsJsonObject().entrySet().forEach(e->row.add(e.getKey(),e.getValue().deepCopy()));return ok(array(rows));}
   if(method.equals("DELETE")){
    if(failDelete)return error(503);
    for(var row:rows){String id=row.get("id").getAsString();table.remove(id);if(convo)messages.values().removeIf(m->m.get("conversation_id").getAsString().equals(id));}return ok(array(rows));
   }
   String time=convo?"updated_at":"created_at";
   rows.sort(Comparator.<JsonObject,Instant>comparing(o->Instant.parse(o.get(time).getAsString())).thenComparing(o->o.get("id").getAsString()).reversed());
   if(q.containsKey("or")){
    String cursor=q.get("or"),at=cursor.substring(cursor.indexOf(".lt.")+4,cursor.indexOf(",and")),id=cursor.substring(cursor.lastIndexOf("id.lt.")+6,cursor.length()-2);
    rows.removeIf(o->{int c=Instant.parse(o.get(time).getAsString()).compareTo(Instant.parse(at));return c>0||c==0&&o.get("id").getAsString().compareTo(id)>=0;});
   }
   int limit=q.containsKey("limit")?Integer.parseInt(q.get("limit")):30;return ok(array(rows.subList(0,Math.min(limit,rows.size()))));
  }
  private JsonArray array(List<JsonObject> rows){var a=new JsonArray();for(var row:rows)a.add(row.deepCopy());return a;}
 }
 public static AssistantApi api(Fake fake){return new AssistantApi("https://ai.example","https://db.example","sb_publishable_test",new SessionManager(),fake);}
 public static ChatSyncService signed(Fake fake){var service=new ChatSyncService(api(fake));service.login("測試帳號","mock-password",()->{});return service;}
 public static void main(String[] args){
  var f=new Fake();var service=signed(f);service.send("第一個問題",()->{});
  require(f.generated==1&&f.messages.size()==2,"user and assistant share cloud conversation");
  require(service.view().messages().stream().allMatch(Message::synced),"both messages synced");
  require(service.view().messages().get(0).role().equals("user"),"chronological role order");
  var a=api(f);a.login("test","mock-password");f.expireOnce=true;a.status();require(f.refreshes==1,"401 refresh rotates exactly once");
  require(a.sessions.get().toString().equals("Session[redacted]"),"session diagnostic redacts tokens");
  f.active=false;fails(a::active,403);require(a.sessions.get()==null,"revoked approval clears memory session");f.active=true;
  var unapproved=new Fake();unapproved.active=false;fails(()->api(unapproved).login("test","mock-password"),403);
  var retry=new Fake();var rs=signed(retry);retry.loseAnswer=true;fails(()->rs.send("逾時測試",()->{}),0);rs.retry(()->{});
  require(retry.generated==1&&retry.requestIds.size()==2&&retry.requestIds.get(0).equals(retry.requestIds.get(1)),"lost response retry reuses UUID and one generated answer");
  require(retry.messages.size()==2,"retry never duplicates messages");
  var targeted=new Fake();var ts=signed(targeted);
  String fixed=new io.github.coyotewolf.aoi.model.TargetQuestion("掉落物","鑽石","minecraft:diamond").attach("這是什麼？");
  targeted.loseAnswer=true;fails(()->ts.send(fixed,()->{}),0);
  require(ts.view().messages().get(0).text().equals(fixed),"pending cloud question contains frozen target");
  ts.retry(()->{});
  require(targeted.questions.equals(List.of(fixed,fixed)),"API and retry receive identical target text");
  require(targeted.generated==1&&targeted.requestIds.get(0).equals(targeted.requestIds.get(1)),"target retry preserves UUID and quota behavior");
  var sceneFake=new Fake();var sceneService=signed(sceneFake);var scene=Models.obj("version",1,"container",Models.obj("name","測試箱子"));sceneFake.loseAnswer=true;
  fails(()->sceneService.send("箱子有什麼？",scene,()->{}),0);scene.addProperty("changed",true);sceneService.retry(()->{});
  require(sceneFake.questions.equals(List.of("箱子有什麼？","箱子有什麼？")),"game context does not consume or rewrite question text");
  require(sceneFake.contexts.get(0).equals(sceneFake.contexts.get(1))&&!sceneFake.contexts.get(1).has("changed"),"retry freezes container and scene even if live inventory changes");
  require(targeted.messages.values().stream().anyMatch(m->m.get("role").getAsString().equals("user")&&m.get("text").getAsString().equals(fixed)),"shared website history preserves target ID and question");
  var pending=new Fake();var ps=signed(pending);pending.failAssistantWrite=true;fails(()->ps.send("同步失敗",()->{}),503);ps.publish("失敗");
  require(ps.view().retry()&&ps.view().messages().stream().anyMatch(m->!m.synced()&&m.role().equals("assistant")),"failed assistant upload stays visibly pending");
  ps.retry(()->{});require(pending.requestIds.size()==1&&pending.messages.size()==2,"pending assistant upload does not call AI twice");
  var cid=ps.view().conversationId();pending.conversations.remove(cid);ps.refresh(()->{});
  require(!cid.equals(ps.view().conversationId())&&!pending.conversations.containsKey(cid),"externally deleted conversation starts new UUID without resurrection");
  String privateId=Models.id();pending.seed(privateId,"private",OTHER);fails(()->ps.select(privateId,()->{}),410);require(ps.view().conversations().stream().noneMatch(c->c.id().equals(privateId)),"other owner conversation stays inaccessible");
  var pages=new Fake();String pcid=Models.id();pages.seed(pcid,"history",OWNER);
  for(int i=0;i<65;i++)pages.seedMessage(pcid,"user","history "+i,Instant.parse("2026-10-09T00:00:00Z").plusSeconds(i/2).toString());
  var pg=signed(pages);pg.select(pcid,()->{});require(pg.view().messages().size()==30&&pg.view().earlier(),"latest history page contains thirty messages");
  pg.older(()->{});pg.older(()->{});require(pg.view().messages().size()==65&&!pg.view().earlier(),"keyset pagination includes tied timestamp UUIDs without loss");
  int reads=pages.operations.size();pg.older(()->{});require(pages.operations.size()==reads&&pg.view().status().contains("沒有更早"),"exhausted older command does not fetch or repeat old rows");
  String first=pg.view().messages().get(0).id();pages.messages.remove(first);pg.refresh(()->{});require(pg.view().messages().stream().noneMatch(m->m.id().equals(first)),"refresh never reuploads remotely removed synced message");
  var lists=new Fake();
  for(int i=0;i<65;i++){String id=Models.id();lists.seed(id,"list "+i,OWNER);lists.conversations.get(id).addProperty("updated_at",Instant.parse("2026-10-09T00:00:00Z").plusSeconds(i/2).toString());}
  lists.seed(Models.id(),"other owner private",OTHER);
  var ls=signed(lists);require(ls.view().conversations().size()==30,"login loads first cloud page");
  String removed=ls.view().conversations().get(5).id(),renamed=ls.view().conversations().get(8).id();lists.conversations.remove(removed);lists.conversations.get(renamed).addProperty("title","website renamed");
  ls.refreshHistory(true);ls.publish("test");require(ls.view().conversations().size()==60&&ls.view().moreConversations(),"more refetches visible range plus next page");
  require(ls.view().conversations().stream().noneMatch(c->c.id().equals(removed))&&ls.view().conversations().stream().anyMatch(c->c.id().equals(renamed)&&c.title().equals("website renamed")),"more reflects website deletion and title changes");
  ls.refreshHistory(true);ls.publish("test");require(ls.view().conversations().size()==64&&!ls.view().moreConversations(),"conversation tied timestamps paginate without duplicates or other accounts");
  var before=ls.view().conversations();try{ls.refreshHistory(true,()->{throw new CancellationException();});throw new AssertionError();}catch(CancellationException expected){ls.publish("test");require(ls.view().conversations().equals(before),"cancelled paging preserves prior visible list");}
  String cloud=ls.view().conversations().get(0).id();ls.select(cloud,()->{});lists.seedMessage(cloud,"assistant","new website reply","2026-10-12T00:00:00Z");ls.refresh(()->{});require(ls.view().messages().stream().anyMatch(m->m.text().equals("new website reply")),"message refresh fetches newly added website reply");
  var bounded=new Fake();String bc=Models.id();bounded.seed(bc,"bounded history",OWNER);for(int i=0;i<305;i++)bounded.seedMessage(bc,"user","older "+i,Instant.parse("2026-10-09T00:00:00Z").plusSeconds(i).toString());
  var bs=signed(bounded);bs.select(bc,()->{});bounded.loseAnswer=true;fails(()->bs.send("pending",()->{}),0);
  for(int i=0;i<9;i++)bs.older(()->{});require(bs.view().messages().size()==300&&bs.view().retry(),"older cap is exact even with an outstanding question and partial page");
  var local=new Fake();var localApi=api(local);localApi.login("test","mock-password");local.locate=true;int[] scans={0};localApi.searchHandler(query->{scans[0]++;require(query.query().equals("虛顎龍")&&query.radius()==0,"AI location request preserves all-loaded default");return "最近的虛顎龍在北方3格";});
  require(localApi.ask("請幫我找牠",Models.id(),Models.id()).text().contains("北方3格")&&scans[0]==1,"AI dispatch returns real client finder result without a second question");
  var del=new Fake();var ds=signed(del);ds.send("删除前問題",()->{});String dcid=ds.view().conversationId();String mid=ds.view().messages().get(0).id();
  del.failForget=true;fails(()->ds.delete(dcid,mid,()->{}),503);require(del.messages.containsKey(mid),"forget failure preserves cloud message");
  del.failForget=false;del.failDelete=true;fails(()->ds.delete(dcid,mid,()->{}),503);require(ds.view().messages().stream().anyMatch(m->m.id().equals(mid)),"delete failure keeps local message");
  del.failDelete=false;ds.delete(dcid,mid,()->{});require(!del.messages.containsKey(mid)&&del.conversations.get(dcid).get("title").getAsString().equals("新對話"),"single question deletion also removes its title");
  require(del.operations.lastIndexOf("POST /forget")<del.operations.lastIndexOf("DELETE /rest/v1/assistant_messages"),"forget precedes database deletion");
  ds.delete(dcid,null,()->{});require(!del.conversations.containsKey(dcid)&&del.messages.isEmpty()&&!ds.view().conversationId().equals(dcid),"conversation cascade and local reset");
  var cancel=new Fake();var cs=signed(cancel);boolean[] cancelled={false};cancel.onAsk=()->cancelled[0]=true;
  try{cs.send("取消等待",()->{if(cancelled[0])throw new CancellationException();});throw new AssertionError();}catch(CancellationException expected){}
  require(cancel.messages.values().stream().noneMatch(m->m.get("role").getAsString().equals("assistant")),"cancelled old answer does not upload");
  cancelled[0]=false;cancel.onAsk=()->{};cs.retry(()->{});require(cancel.generated==1&&cancel.messages.size()==2,"cancel retry uses same successful request cache");
  var sessions=new SessionManager();long lease=sessions.generation();sessions.clear();try{sessions.install(cancel.session(),lease);throw new AssertionError();}catch(CancellationException expected){require(sessions.get()==null,"old login cannot restore session after logout");}
  require(Models.answer(Models.obj("answer","正常回答","facts",new JsonArray())).facts().isEmpty(),"answer accepts absent optional provider and remaining");
  try{Models.answer(new JsonObject());throw new AssertionError();}catch(IllegalArgumentException expected){require(true,"invalid answer never becomes a successful message");}
  require(Models.safe("a\u0000§b\n繁中",50).equals("a b\n繁中"),"remote controls and format codes sanitized");
  var limited=new Transport.LimitedBody();boolean[] boundedCancelled={false};limited.onSubscribe(new java.util.concurrent.Flow.Subscription(){public void request(long n){}public void cancel(){boundedCancelled[0]=true;}});
  limited.onNext(List.of(java.nio.ByteBuffer.wrap(new byte[2_000_001])));require(boundedCancelled[0]&&limited.getBody().toCompletableFuture().isCompletedExceptionally(),"oversized HTTP body cancels before allocation");
  var numeric=api(new Fake());numeric.login("mock","mock-password");
  var errorApi=new AssistantApi("https://ai.example","https://db.example","public",numeric.sessions,(method,url,headers,body,timeout)->new Transport.Reply(429,Models.obj("error","quota","retryAt",new com.google.gson.JsonPrimitive(Instant.now().plusSeconds(60).toEpochMilli()))));
  try{errorApi.status();throw new AssertionError();}catch(ApiException e){require(!e.retryAt.isBlank()&&e.status==429,"numeric provider retryAt is displayed");}
  try{new AssistantApi("http://ai.example","https://db.example","key",sessions,cancel);throw new AssertionError();}catch(IllegalArgumentException expected){require(true,"insecure endpoint rejected");}
  cs.logout();require(!cs.view().loggedIn()&&cs.view().messages().isEmpty(),"logout clears all local chat and credentials");
  System.out.println("Client verification passed: "+checks+" assertions.");
 }
}
