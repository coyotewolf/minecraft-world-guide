package io.github.coyotewolf.aoi.client.commands;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import io.github.coyotewolf.aoi.client.*;
import io.github.coyotewolf.aoi.model.Models;
import io.github.coyotewolf.aoi.model.Models.Message;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.ChatScreen;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.network.chat.*;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.*;
import net.minecraftforge.eventbus.api.*;
import net.minecraftforge.fml.common.Mod;
import io.github.coyotewolf.aoi.AoiAssistantMod;
import org.lwjgl.glfw.GLFW;
import java.util.*;
import java.util.function.Consumer;

@Mod.EventBusSubscriber(modid=AoiAssistantMod.ID,value=Dist.CLIENT,bus=Mod.EventBusSubscriber.Bus.FORGE)
public final class ChatCommands {
 private static final ReplySources sources=new ReplySources();
 private static final Set<String> printed=new HashSet<>();
 private static String queuedQuestion="";
 private static com.google.gson.JsonObject queuedContext=new com.google.gson.JsonObject();
 private record Deletion(String token,String owner,String conversation,String message,long expires){}
 private static Deletion deletion;
 private static final CommandRoutes.Handler HANDLER=new CommandRoutes.Handler(){
  public void question(String q){ask(q);}
  public void action(CommandRoutes.Action a,String arg){handle(a,arg);}
 };
 private static final CommandDispatcher<Object> local=new CommandDispatcher<>();
 static {CommandRoutes.register(local,HANDLER);}
 @SubscribeEvent public static void register(RegisterClientCommandsEvent e){CommandRoutes.register(e.getDispatcher(),HANDLER);}
 @SubscribeEvent(priority=EventPriority.LOWEST) public static void enter(ScreenEvent.KeyPressed.Pre e){
  if(!(e.getScreen() instanceof ChatScreen)||e.getKeyCode()!=GLFW.GLFW_KEY_ENTER&&e.getKeyCode()!=GLFW.GLFW_KEY_KP_ENTER)return;
  String input=e.getScreen().children().stream().filter(EditBox.class::isInstance).map(EditBox.class::cast).map(EditBox::getValue).findFirst().orElse("");
  if(!CommandRoutes.owns(input))return;
  // Cancel before vanilla adds history or calls ClientPacketListener.sendCommand.
  // This also catches malformed /ai commands which Forge otherwise forwards.
  e.setCanceled(true);Minecraft.getInstance().setScreen(null);submit(input);
 }
 @SubscribeEvent(priority=EventPriority.HIGHEST) public static void click(ScreenEvent.MouseButtonPressed.Pre e){
  if(!(e.getScreen() instanceof ChatScreen)||e.getButton()!=GLFW.GLFW_MOUSE_BUTTON_LEFT)return;
  Style style=Minecraft.getInstance().gui.getChat().getClickedComponentStyleAt(e.getMouseX(),e.getMouseY());
  if(handleClick(style))e.setCanceled(true);
 }
 public static boolean handleClick(Style style){
  if(style==null||style.getClickEvent()==null)return false;
  var event=style.getClickEvent();String command=CommandRoutes.clickedCommand(event.getAction().name(),event.getValue());
  if(command==null)return false;
  submit(command);return true;
 }
 @SubscribeEvent(priority=EventPriority.HIGHEST) public static void outgoing(ClientChatEvent e){
  if(CommandRoutes.owns(e.getMessage())){e.setCanceled(true);submit(e.getMessage());}
 }
 public static void submit(String input){
  try{local.execute(CommandRoutes.command(input),new Object());}
  catch(CommandSyntaxException|IllegalArgumentException e){say("指令格式不正確。直接輸入 /ai 問題；登入請用 /ai 登入，不要把密碼放進指令。");}
 }
 public static void say(String text){LocalChat.add(Component.literal("[AI] ").withStyle(ChatFormatting.AQUA).append(Component.literal(Models.safe(text,8000)).withStyle(ChatFormatting.WHITE)));}
 private static Component link(String label,String command){return Component.literal(label).withStyle(s->s.withColor(ChatFormatting.YELLOW).withClickEvent(new ClickEvent(ClickEvent.Action.RUN_COMMAND,command)).withHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT,Component.literal(command))));}
 public static void clearLocal(){sources.clear();printed.clear();deletion=null;LocalChat.clear();}
 public static void loginReady(){
  clearLocal();say("已登入攻略帳號。直接在聊天欄輸入 /ai 問題。");
  String warning=ChatController.get().sessions.storageNotice();if(!warning.isBlank())say(warning);
  String question=queuedQuestion;queuedQuestion="";if(!question.isBlank())ask(question,false);
 }
 public static void login(){
  var c=ChatController.get();if(c.busy){say("目前正在處理，請先等待或輸入 /ai 取消。");return;}
  var mc=Minecraft.getInstance();mc.tell(()->mc.setScreen(new AssistantLoginScreen(mc.screen instanceof ChatScreen?null:mc.screen)));
 }
 private static boolean ready(){
  var c=ChatController.get();if(!c.service.view().loggedIn()){
   LocalChat.add(Component.literal("[AI] 請先連接攻略帳號。 ").withStyle(ChatFormatting.AQUA).append(link("[登入]","/ai 登入")));return false;
  }
  if(c.busy){say("小助手仍在處理上一個請求。可以輸入 /ai 取消。");return false;}return true;
 }
 private static void work(String waiting,ChatController.Action action,Consumer<ChatController.Outcome> done){
  work(waiting,false,action,done);
 }
 private static void work(String waiting,boolean deleting,ChatController.Action action,Consumer<ChatController.Outcome> done){
  var c=ChatController.get();say(waiting);c.run(waiting,deleting,action,r->{sources.sync(r.view().conversationId(),r.view().messages());done.accept(r);});
 }
 private static void ask(String question){
  ask(question,true);
 }
 private static void ask(String question,boolean attachTarget){
  if(question.isBlank()||question.length()>600){say("請輸入 1～600 字的問題。");return;}
  String original=question;
  var context=attachTarget?GameScene.withPlayerContext(GameScene.current(),null):queuedContext.deepCopy();
  var c=ChatController.get();if(!c.service.view().loggedIn()){queuedQuestion=question;queuedContext=context.deepCopy();ready();return;}
  if(!ready())return;
  if(c.service.view().retry()){say("上一則提問尚未完成，請輸入 /ai 重試，沿用同一提問 ID。");return;}
  Minecraft.getInstance().gui.getChat().addRecentChat("/ai "+original);
  say("你問："+question);
  String prepared=question;
  work("正在思考……",check->c.service.send(prepared,context,check),ChatCommands::answer);
 }
 private static void answer(ChatController.Outcome result){
  boolean emitted=false;
  for(Message message:result.view().messages())if(message.role().equals("assistant")&&!printed.contains(message.id())){
   // Only the latest reply belongs to this operation, not older cloud history.
   if(message!=result.view().messages().get(result.view().messages().size()-1))continue;
   emitted=true;printed.add(message.id());
   say(message.text());
   if(!message.synced())say("僅存本機；/ai 重試可同步");
  }
  if(!result.success()||result.view().retry())say(result.status());
  else if(!emitted)say(result.status());
 }
 private static void handle(CommandRoutes.Action action,String arg){
  if(action==CommandRoutes.Action.BIOME){say(CurrentBiome.find());return;}
  if(action==CommandRoutes.Action.ID){try{say(RegistryIds.find(io.github.coyotewolf.aoi.model.RegistryQuery.parse(arg)));}catch(IllegalArgumentException e){say(e.getMessage());}return;}
  if(action==CommandRoutes.Action.VERSION){say(UpdateClient.versionInfo());return;}
  if(action==CommandRoutes.Action.FIND){try{say(NearbyEntities.find(io.github.coyotewolf.aoi.model.NearbyQuery.parse(arg)));}catch(IllegalArgumentException e){say(e.getMessage());}return;}
  var c=ChatController.get();
  switch(action){
   case HELP->{say("直接輸入 /ai 問題，或 /小助手 問題。附近位置問題由AI理解後交給本機搜尋；/ai find 實體名稱 [半徑]可直接搜尋，省略半徑搜尋全部已載入範圍並回報最近的實體。回答只顯示在你本機，不發到伺服器。");say("/ai 登入、登出、重試、取消、新對話、歷史、更多、切換 對話ID、同步、紀錄、來源、狀態、刪除。刪除需再次確認；密碼只在登入視窗輸入。");say("/ai message 或 messages 會先同步目前對話；/ai more 更新對話清單並載入下一頁；/ai older 載入目前對話的更早訊息。/ai biome 或 /ai 生態域 查目前生態域名稱與完整ID；/ai id 名稱 查完整ID；/ai id 查指向目標，沒有目標時查主手；/ai id 手持 查主手。/ai 版本 或 /ai version 查看目前實際載入的模組版本；/ai 更新 手動檢查更新。");}
   case LOGIN->login();
   case UPDATE->say(UpdateClient.checkNow());
   case CANCEL->{if(c.deleting)say("刪除正在處理，請等待完成。");else{c.cancel();say(c.notice);}}
   case LOGOUT->{if(c.deleting){say("請等待刪除完成後再登出。");return;}queuedQuestion="";c.cancel();clearLocal();c.drafts.clear();work("正在登出……",check->{c.service.logout();check.run();},r->say(r.status()));}
   case SOURCES->showSources(arg);
   case KEEP->{deletion=null;say("已取消刪除。");}
   default->{
    if(!ready())return;
    switch(action){
     case NEW->work("建立新對話……",check->c.service.newConversation(),r->say(r.status()));
     case RETRY->{if(!c.service.view().retry()){say("目前沒有待重試的提問。");return;}work("正在重試同一則提問……",c.service::retry,ChatCommands::answer);}
     case HISTORY,MORE->work("載入雲端對話……",check->{c.service.refreshHistory(action==CommandRoutes.Action.MORE,check);check.run();c.service.publish("已載入對話清單。");},r->{if(!r.success()){say(r.status());return;}for(var row:r.view().conversations())LocalChat.add(Component.literal("[AI] ").withStyle(ChatFormatting.AQUA).append(link(Models.safe(row.title(),80),"/ai 切換 "+row.id())));if(r.view().moreConversations())say("/ai 更多 可載入下一批。");else if(r.view().conversations().size()>=300)say("清單最多顯示300段；/ai 歷史可重新載入最新清單。");});
     case USE->{try{Models.uuid(arg);}catch(IllegalArgumentException e){say("對話 ID 不正確；用 /ai 歷史 並點選對話。");return;}work("切換對話……",check->c.service.select(arg,check),r->{say(r.status());if(r.success())recent(r.view().messages());});}
     case REFRESH->work("同步雲端紀錄……",c.service::refresh,r->say(r.status()));
     case MESSAGES->work("同步目前對話……",c.service::refresh,r->{say(r.status());if(r.success())recent(r.view().messages());});
     case OLDER->{
      var before=new HashSet<String>();for(var m:c.service.view().messages())before.add(m.id());
      work("載入更早訊息……",c.service::older,r->{say(r.status());if(r.success())showMessages(r.view().messages().stream().filter(m->!before.contains(m.id())).toList());});
     }
     case STATUS->work("查詢服務狀態……",check->c.service.availability(),r->say(r.status()));
     case DELETE->{
      String mid=null;
      if(!arg.isBlank()){
       try{mid=Models.uuid(arg);}catch(IllegalArgumentException e){say("訊息 ID 不正確。");return;}
       String selected=mid;if(c.service.view().messages().stream().noneMatch(m->m.id().equals(selected))){say("這則訊息不在目前對話；請先切換至原對話。");return;}
      }
      var session=c.sessions.get();if(session==null){ready();return;}
      deletion=new Deletion(Models.id(),session.userId,c.service.view().conversationId(),mid,System.currentTimeMillis()+180000);
      LocalChat.add(Component.literal("[AI] "+(mid==null?"刪除目前整段對話？":"刪除這則訊息？")+" 雲端紀錄也會移除。 ").withStyle(ChatFormatting.GOLD).append(link("[確定刪除] ","/ai 確認刪除 "+deletion.token())).append(link("[保留]","/ai 保留")));
     }
     case CONFIRM->{
      var target=deletion;var session=c.sessions.get();
      if(target==null||!target.token().equals(arg)||target.expires()<System.currentTimeMillis()||session==null||!session.userId.equals(target.owner())||!c.service.view().conversationId().equals(target.conversation())){deletion=null;say("確認已過期或對話已切換，請重新選擇刪除。");return;}
      deletion=null;work("正在刪除雲端紀錄……",true,check->c.service.delete(target.conversation(),target.message(),check),r->{if(r.success()){clearLocal();sources.sync(r.view().conversationId(),r.view().messages());say("刪除完成；原有免費用量仍保留。");}else say(r.status());});
     }
     default->{}
    }
   }
  }
 }
 private static void recent(List<Message> messages){
  if(messages.isEmpty()){say("這段對話目前沒有訊息。");return;}
  showMessages(messages.subList(Math.max(0,messages.size()-10),messages.size()));
 }
 private static void showMessages(List<Message> messages){
  for(Message m:messages)say((m.role().equals("user")?"你：":"小助手：")+m.text());
 }
 private static void showSources(String arg){
  if(!ChatController.get().service.view().loggedIn()){ready();return;}
  int index=arg.isBlank()?sources.latestIndex():Integer.parseInt(arg);Message m=sources.get(index);
  if(m==null){say("這則來源已不在本機暫存；請查看網站對話紀錄。");return;}
  if(m.facts().isEmpty()){say("這則回答沒有提供來源。");return;}
  int count=0;for(var item:m.facts()){
   if(count++>=12)break;
   if(item.isJsonObject()){
    var f=item.getAsJsonObject();say(Models.text(f,"playerTitle",Models.text(f,"title","來源")));
    String summary=Models.text(f,"playerSummary",Models.text(f,"text",""));if(!summary.isBlank())say(Models.safe(summary,2400));
    String source=Models.text(f,"source","");if(!source.isBlank())say("依據："+Models.safe(source,600));
    if(summary.isBlank()&&source.isBlank())say(Models.safe(item.toString(),1200));
   }else say(Models.safe(item.toString(),1200));
  }
 }
 private ChatCommands(){}
}
