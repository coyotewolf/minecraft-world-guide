package io.github.coyotewolf.aoichecks;

import com.mojang.brigadier.*;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import io.github.coyotewolf.aoi.client.commands.CommandRoutes;
import io.github.coyotewolf.aoi.client.commands.ImeCommandPolicy;
import java.util.*;

public final class CommandChecks {
 private static int checks;
 private static void require(boolean ok,String label){if(!ok)throw new AssertionError(label);checks++;System.out.println("COMMAND PASS "+label);}
 public static void main(String[] args)throws Exception{
  var dispatcher=new CommandDispatcher<Object>();var questions=new ArrayList<String>();var actions=new ArrayList<String>();
  CommandRoutes.register(dispatcher,new CommandRoutes.Handler(){
   public void question(String q){questions.add(q);}
   public void action(CommandRoutes.Action a,String value){actions.add(a.name()+":"+value);}
  });
  Object source=new Object();dispatcher.execute("ai 龍族裝備怎麼取得？ 請保留 English mod names",source);
  var visibleRows=new ArrayList<com.google.gson.JsonObject>();for(int i=0;i<40;i++)visibleRows.add(io.github.coyotewolf.aoi.model.Models.obj("id","minecraft:cod","distance",i));
  visibleRows.add(io.github.coyotewolf.aoi.model.Models.obj("id","saintsdragons:ignivorus","distance",80));
  var chosen=io.github.coyotewolf.aoi.model.SceneSelection.choose(visibleRows,32);
  require(chosen.size()==32&&chosen.get(1).getAsJsonObject().get("id").getAsString().equals("saintsdragons:ignivorus"),"visible distant dragon survives crowd of nearby duplicate species");
  visibleRows.get(0).addProperty("id","changed");require(chosen.get(0).getAsJsonObject().get("id").getAsString().equals("minecraft:cod"),"visible candidate snapshot is immutable");
  var target=new io.github.coyotewolf.aoi.model.TargetQuestion("方塊","秘銀礦石","irons_spellbooks:mithril_ore");
  String prepared=target.attach("這要怎麼挖？");
  require(prepared.contains("irons_spellbooks:mithril_ore")&&prepared.endsWith("這要怎麼挖？"),"target identity and player question survive together");
  int overhead=target.attach("").length();
  require(target.attach("問".repeat(600-overhead)).length()==600,"target question accepts exact API limit");
  try{target.attach("問".repeat(601-overhead));throw new AssertionError("overflow accepted");}catch(IllegalArgumentException expected){require(true,"target overflow rejected without silently truncating question");}
  require(questions.get(0).equals("龍族裝備怎麼取得？ 請保留 English mod names"),"Chinese greedy question keeps spaces and English");
  dispatcher.execute("小助手 AE2 怎麼開始",source);require(questions.get(1).equals("AE2 怎麼開始"),"Chinese root alias");
  dispatcher.execute("ai ask status 這個字是問題",source);require(questions.get(2).equals("status 這個字是問題"),"ask can escape reserved action names");
  for(String text:List.of("ai","ai 登入","ai login","ai 新對話","ai 重試","ai 取消","ai 歷史","ai 同步","ai 登出"))dispatcher.execute(text,source);
  require(actions.containsAll(List.of("HELP:","LOGIN:","NEW:","RETRY:","CANCEL:","HISTORY:","REFRESH:","LOGOUT:")),"all primary command actions route locally");
  dispatcher.execute("ai biome",source);dispatcher.execute("ai 生態域",source);dispatcher.execute("小助手 生物群系",source);require(actions.contains("BIOME:"),"biome aliases route locally without login or server commands");
  dispatcher.execute("ai id",source);dispatcher.execute("ai id 方塊 石頭",source);dispatcher.execute("ai 識別碼 手持",source);require(actions.contains("ID:")&&actions.contains("ID:方塊 石頭")&&actions.contains("ID:手持"),"ID commands are local and preserve complete argument");
  dispatcher.execute("ai sources 3",source);dispatcher.execute("ai 來源",source);require(actions.contains("SOURCES:3")&&actions.contains("SOURCES:"),"source index and most recent source");
  dispatcher.execute("ai 版本",source);dispatcher.execute("ai version",source);dispatcher.execute("小助手 版本",source);require(actions.contains("VERSION:"),"version aliases route locally without login or AI");
  for(String text:List.of("ai message","ai messages","ai 紀錄")){dispatcher.execute(text,source);require(actions.get(actions.size()-1).equals("MESSAGES:"),"message aliases share synchronized message action");}
  require(CommandRoutes.clickedCommand("RUN_COMMAND","/ai 切換 00000000-0000-4000-8000-000000000001")!=null,"history click stays in local route");
  for(String action:List.of("OPEN_URL","SUGGEST_COMMAND","COPY_TO_CLIPBOARD"))require(CommandRoutes.clickedCommand(action,"/ai help")==null,"other click actions remain vanilla");
  require(CommandRoutes.clickedCommand("RUN_COMMAND","/spawn")==null,"server commands are not intercepted");
  String id=UUID.randomUUID().toString();dispatcher.execute("ai 切換 "+id,source);require(actions.contains("USE:"+id),"conversation UUID passes intact");
  for(String text:List.of("/ai"," /ai 怎麼做 ","/小助手 問題","/AI question","/Ai question"))require(CommandRoutes.owns(text),"assistant prefix captured");
  for(String text:List.of("/air test","/aide test","/give player stone","普通聊天 /ai","ai question","/smallai","/小助手們 問題"))require(!CommandRoutes.owns(text),"other messages pass through");
  require(CommandRoutes.command(" /AI 繁中 問題 ").equals("ai 繁中 問題"),"uppercase command normalizes without changing question");
  int before=questions.size()+actions.size();
  for(String command:List.of("ai login mock-password","ai 登入 user password","ai sources 0","ai sources -1","ai sources nonsense","ai use","ai new extra")){
   try{dispatcher.execute(command,source);throw new AssertionError("malformed command accepted");}catch(CommandSyntaxException expected){require(CommandRoutes.owns("/"+command),"malformed assistant commands still captured, never forwarded");}
  }
  require(before==questions.size()+actions.size(),"malformed login does not become a question or credential request");
  var field=CommandRoutes.class.getDeclaredField("ALIASES");field.setAccessible(true);
  @SuppressWarnings("unchecked") var aliases=(Map<CommandRoutes.Action,List<String>>)field.get(null);
  for(String root:List.of("ai","小助手"))for(var entry:aliases.entrySet())for(String alias:entry.getValue()){
   String argument=switch(entry.getKey()){case FIND->"虛顎龍 200";case USE,CONFIRM,DELETE->id;case SOURCES->"1";default->"";};
   int qcount=questions.size();dispatcher.execute(root+" "+alias+(argument.isEmpty()?"":" "+argument),source);
   require(questions.size()==qcount&&actions.get(actions.size()-1).equals(entry.getKey().name()+":"+argument),"every root and alias routes to its own local action");
  }
  for(String text:List.of("ai find","ai 附近","ai confirm","ai ask","ai older extra","ai status extra","ai messages extra","ai update extra","小助手 確認刪除")){
   int count=questions.size()+actions.size();try{dispatcher.execute(text,source);throw new AssertionError("malformed accepted");}catch(CommandSyntaxException expected){require(questions.size()+actions.size()==count,"bad arguments cannot reach actions or AI");}
  }
  var cache=new io.github.coyotewolf.aoi.client.commands.ReplySources();var replies=new ArrayList<io.github.coyotewolf.aoi.model.Models.Message>();
  for(int i=0;i<100;i++)replies.add(new io.github.coyotewolf.aoi.model.Models.Message(UUID.randomUUID().toString(),id,"assistant","reply "+i,new com.google.gson.JsonArray(),"2026-10-12T00:00:00Z",true));
  cache.sync(id,replies);int last=cache.latestIndex();cache.sync(id,replies);require(cache.latestIndex()==last&&cache.get(last).text().equals("reply 99"),"source indexes stable across unchanged sync and older pages");
  cache.sync(id,replies.subList(0,99));require(cache.get(last)==null&&cache.get(cache.latestIndex()).text().equals("reply 98"),"deleted reply sources removed and latest falls back correctly");
  cache.clear();cache.sync(id,replies.subList(0,99));require(cache.get(cache.latestIndex()).text().equals("reply 98"),"remaining sources rebuild after deletion clears local chat");
  String other=UUID.randomUUID().toString();cache.sync(other,List.of(new io.github.coyotewolf.aoi.model.Models.Message(UUID.randomUUID().toString(),other,"assistant","other conversation",new com.google.gson.JsonArray(),"2026-10-12T00:00:00Z",true)));require(cache.get(1).text().equals("other conversation"),"source cache never crosses conversations");
  var suggestions=dispatcher.getCompletionSuggestions(dispatcher.parse("ai ",source)).get();
  require(suggestions.getList().stream().anyMatch(s->s.getText().equals("登入"))&&suggestions.getList().stream().anyMatch(s->s.getText().equals("history")),"slash autocomplete contains local actions");
  require(dispatcher.getRoot().getChild("give")==null,"no server command registration");
  var ime=new ImeCommandPolicy();var states=new ArrayList<Boolean>();
  ime.update("/give player stone",18,true,states::add);require(states.isEmpty(),"other command IME preference unchanged");
  ime.update("/ai ",4,true,states::add);require(states.equals(List.of(true)),"AI prefix enables edit state despite command-mode block");
  ime.update("/ai ",4,true,states::add);require(states.size()==1,"unchanged text does not repeatedly toggle IME");
  ime.update("/ai 中文問題",8,true,states::add);require(states.equals(List.of(true,true)),"Chinese edit preserves AI exception");
  ime.update("/give player stone",18,true,states::add);require(states.get(2)==false,"leaving AI for another command restores command-mode block");
  ime.update("/小助手 問題",7,true,states::add);ime.update("普通聊天",4,true,states::add);require(states.get(states.size()-1),"leaving AI for ordinary chat permits ordinary IME");
  ime.reset();states.clear();ime.update("/ai question",12,false,states::add);require(states.isEmpty(),"already-enabled command IME is not overridden");
  System.out.println("Command verification passed: "+checks+" assertions.");
 }
}
