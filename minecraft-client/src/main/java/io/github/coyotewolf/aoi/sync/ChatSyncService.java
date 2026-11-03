package io.github.coyotewolf.aoi.sync;

import io.github.coyotewolf.aoi.model.Models;
import io.github.coyotewolf.aoi.model.Models.*;
import io.github.coyotewolf.aoi.net.*;
import java.time.Instant;
import java.util.*;

/** All mutation runs on one network executor; UI reads immutable snapshots. */
public final class ChatSyncService {
 public record View(String conversationId,List<Message> messages,List<Conversation> conversations,boolean earlier,boolean moreConversations,boolean retry,boolean loggedIn,String status) {}
 private static final class Pending {
  Message user,assistant;
  final com.google.gson.JsonObject context;
  final String assistantId=Models.id();
  Pending(Message user,com.google.gson.JsonObject context){this.user=user;this.context=context.deepCopy();}
 }
 private static final class State {
  final String id;
  boolean known,earlier;
  final List<Message> messages=new ArrayList<>();
  Pending pending;
  State(String id){this.id=id;}
 }
 private final AssistantApi api;
 private final Map<String,State> states=new HashMap<>();
 private State state=new State(Models.id());
 private final List<Conversation> history=new ArrayList<>();
 private boolean moreConversations;
 private volatile View view;
 public ChatSyncService(AssistantApi api){this.api=api;states.put(state.id,state);publish("請登入攻略網站帳號。");}
 public View view(){return view;}
 public void publish(String status){view=new View(state.id,List.copyOf(state.messages),List.copyOf(history),state.earlier,moreConversations,state.pending!=null,api.sessions.get()!=null,Models.safe(status+" "+api.sessions.storageNotice(),360).trim());}
 public void restore(Runnable check){api.active();check.run();refreshHistory(false,check);check.run();publish("已自動恢復登入，聊天紀錄與網站共用。");}
 public void login(String gameId,String password,Runnable check){
  api.login(gameId,password);check.run();states.clear();history.clear();state=new State(Models.id());states.put(state.id,state);
  refreshHistory(false,check);check.run();publish("已登入，聊天紀錄與網站共用。");
 }
 public void logout(){api.logout();states.clear();history.clear();state=new State(Models.id());states.put(state.id,state);publish("已登出並清空本機聊天與草稿。");}
 public void newConversation(){state=new State(Models.id());states.put(state.id,state);publish("新對話；首次傳送後同步至雲端。");}
 public void refreshHistory(boolean more){refreshHistory(more,()->{});}
 public void refreshHistory(boolean more,Runnable check){
  // Reload the already displayed range as well as the next page. Append-only
  // paging retained website deletions, stale titles and an obsolete order.
  int limit=more?Math.min(300,history.size()+30):30;
  var fresh=new LinkedHashMap<String,Conversation>();Conversation cursor=null;
  boolean next=false;
  for(int page=0;page<10;page++){
   check.run();var result=api.conversations(cursor);check.run();
   for(var row:result.rows())fresh.put(row.id(),row);
   next=result.more();
   if(!next||result.rows().isEmpty()||fresh.size()>=limit)break;
   var tail=result.rows().get(result.rows().size()-1);
   if(cursor!=null&&tail.id().equals(cursor.id())&&tail.updatedAt().equals(cursor.updatedAt()))throw new ApiException(503,"對話分頁未前進，請重新整理。","");
   cursor=tail;
  }
  var sorted=new ArrayList<>(fresh.values());
  sorted.sort(Comparator.comparing((Conversation c)->Instant.parse(c.updatedAt())).thenComparing(Conversation::id).reversed());
  // Commit only after all requests/checks succeed; failures keep the prior list.
  history.clear();history.addAll(sorted.subList(0,Math.min(limit,sorted.size())));
  moreConversations=next&&history.size()<300;
 }
 public void select(String cid,Runnable check){
  Models.uuid(cid);check.run();if(!api.exists(cid)){api.active();throw new ApiException(410,"這段對話已被刪除，請重新整理清單。","");}
  State target=states.computeIfAbsent(cid,State::new);var page=api.messages(cid,null);check.run();
  merge(target,page.rows(),false);target.known=true;target.earlier=page.more();state=target;publish("已載入雲端對話。");
 }
 private void merge(State target,List<Message> remote,boolean older){
  var pending=target.messages.stream().filter(m->!m.synced()).toList();
  if(!older)target.messages.clear();
  for(Message m:remote){target.messages.removeIf(local->local.id().equals(m.id()));target.messages.add(m);}
  for(Message m:pending)if(target.messages.stream().noneMatch(local->local.id().equals(m.id())))target.messages.add(m);
  target.messages.sort(Models.MESSAGE_ORDER);
 }
 public void refresh(Runnable check){
  api.active();check.run();refreshHistory(false,check);check.run();
  if(state.known){
   if(!api.exists(state.id)){api.active();check.run();states.remove(state.id);newConversation();publish("網站已刪除原對話；已開新對話，舊訊息不會上傳。");return;}
   var page=api.messages(state.id,null);check.run();merge(state,page.rows(),false);state.earlier=page.more();
  }
  publish("已重新整理雲端紀錄；待同步訊息可按重試。");
 }
 public void older(Runnable check){
  if(!state.earlier){publish("目前沒有更早的訊息。");return;}
  if(state.messages.size()>=300)throw new ApiException(400,"已載入 300 則訊息；按重新整理可回到最新紀錄。","");
  Message cursor=state.messages.stream().filter(Message::synced).min(Models.MESSAGE_ORDER).orElse(null);
  if(cursor==null){publish("目前沒有可載入的雲端訊息。");return;}
  if(!api.exists(state.id))throw new ApiException(410,"對話已刪除，請重新整理。","");
  var page=api.messages(state.id,cursor);check.run();int count=Math.min(300-state.messages.size(),page.rows().size());var rows=page.rows().subList(page.rows().size()-count,page.rows().size());merge(state,rows,true);state.earlier=page.more()||count<page.rows().size();publish(count==0?"目前沒有更早的訊息。":"已載入更早訊息。");
 }
 public void send(String question,Runnable check){send(question,new com.google.gson.JsonObject(),check);}
 public void send(String question,com.google.gson.JsonObject context,Runnable check){
  if(state.pending!=null)throw new ApiException(409,"上一則訊息尚未完成，請先重試或刪除。","");
  if(question==null||question.isBlank()||question.length()>600)throw new ApiException(400,"請輸入 1～600 字的問題。","");
  if(state.messages.size()>=300)throw new ApiException(400,"此頁已載入大量訊息，請重新整理後提問。","");
  var m=new Message(Models.id(),state.id,"user",question.trim(),new com.google.gson.JsonArray(),Instant.now().toString(),false);
  state.pending=new Pending(m,context);state.messages.add(m);publish("訊息僅存本機，正在同步……");retry(check);
 }
 private void replace(Message m){state.messages.removeIf(old->old.id().equals(m.id()));state.messages.add(m);state.messages.sort(Models.MESSAGE_ORDER);}
 public void retry(Runnable check){
  Pending p=state.pending;if(p==null)return;
  check.run();api.active();check.run();
  api.ensure(state.id,p.user.text(),state.known);state.known=true;check.run();
  if(!p.user.synced()){api.put(p.user);check.run();p.user=p.user.syncedCopy();replace(p.user);}
  if(!api.messageExists(state.id,p.user.id())){api.active();state.pending=null;state.messages.removeIf(m->m.id().equals(p.user.id())||(p.assistant!=null&&m.id().equals(p.assistant.id())));throw new ApiException(409,"這則提問已在另一個裝置刪除；不會重新上傳。","");}
  check.run();
  if(p.assistant==null){
   Answer answer=api.ask(p.user.text(),state.id,p.user.id(),p.context);check.run();
   p.assistant=new Message(p.assistantId,state.id,"assistant",answer.text(),answer.facts(),Instant.now().toString(),false);replace(p.assistant);publish("回答已收到，正在同步……");
  }
  check.run();
  if(!api.messageExists(state.id,p.user.id()))throw new ApiException(409,"提問已變更，請重新整理後處理待同步訊息。","");
  api.put(p.assistant);check.run();replace(p.assistant.syncedCopy());state.pending=null;
  refreshHistory(false,check);check.run();publish("雲端已同步。");
 }
 public void delete(String cid,String mid,Runnable check){
  check.run();api.active();check.run();api.forget(cid);check.run();
  State target=states.get(cid);
  if(mid!=null&&target!=null){
   Message deleted=target.messages.stream().filter(m->m.id().equals(mid)).findFirst().orElse(null);
   if(deleted!=null&&deleted.role().equals("user")){
    // Read complete authoritative cloud history when renaming, never retain the deleted title.
    var page=api.messages(cid,null);check.run();
    String title=page.rows().stream().filter(m->m.role().equals("user")&&!m.id().equals(mid)).map(Message::text).findFirst().orElse("新對話");
    api.rename(cid,title);check.run();
   }
  }
  api.delete(cid,mid);check.run();
  if(mid==null){states.remove(cid);history.removeIf(c->c.id().equals(cid));if(state.id.equals(cid))newConversation();}
  else if(target!=null){
   target.messages.removeIf(m->m.id().equals(mid));
   if(target.pending!=null&&(target.pending.user.id().equals(mid)||target.pending.assistant!=null&&target.pending.assistant.id().equals(mid))){
    var pending=target.pending;target.messages.removeIf(m->!m.synced()&&(m.id().equals(pending.user.id())||pending.assistant!=null&&m.id().equals(pending.assistant.id())));target.pending=null;
   }
  }
  publish("刪除完成；原有每日用量仍保留。");refreshHistory(false);
 }
 public void availability(){
  var o=api.status();var providers=o.has("providers")&&o.get("providers").isJsonArray()?o.getAsJsonArray("providers"):new com.google.gson.JsonArray();
  var labels=new ArrayList<String>();for(var p:providers)if(p.isJsonObject()){
   var v=p.getAsJsonObject();boolean available=v.has("available")&&v.get("available").getAsBoolean();
   labels.add(Models.text(v,"provider","供應商")+"："+(available?"可用":"暫時不可用"));
  }
  publish(labels.isEmpty()?Models.text(o,"message","服務已連線。"):String.join("；",labels));
 }
}
