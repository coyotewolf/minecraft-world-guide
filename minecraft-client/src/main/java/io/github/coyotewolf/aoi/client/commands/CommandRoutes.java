package io.github.coyotewolf.aoi.client.commands;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.*;
import com.mojang.brigadier.builder.*;
import java.util.*;

/** Pure command grammar. No Minecraft packet, credential or network access. */
public final class CommandRoutes {
 public enum Action { BIOME,ID,VERSION,FIND,HELP,LOGIN,LOGOUT,NEW,RETRY,CANCEL,HISTORY,MORE,USE,REFRESH,MESSAGES,OLDER,STATUS,SOURCES,DELETE,CONFIRM,KEEP,UPDATE }
 public interface Handler {void question(String question);void action(Action action,String argument);}
 private static final Map<Action,List<String>> ALIASES=new LinkedHashMap<>();
 static {
  ALIASES.put(Action.FIND,List.of("find","附近"));
  ALIASES.put(Action.VERSION,List.of("version","版本"));ALIASES.put(Action.ID,List.of("id","ID","識別碼"));ALIASES.put(Action.BIOME,List.of("biome","生態域","生物群系"));
  ALIASES.put(Action.UPDATE,List.of("update","更新"));ALIASES.put(Action.HELP,List.of("help","說明"));ALIASES.put(Action.LOGIN,List.of("login","登入"));
  ALIASES.put(Action.LOGOUT,List.of("logout","登出"));ALIASES.put(Action.NEW,List.of("new","新對話"));
  ALIASES.put(Action.RETRY,List.of("retry","重試"));ALIASES.put(Action.CANCEL,List.of("cancel","取消"));
  ALIASES.put(Action.HISTORY,List.of("history","歷史"));ALIASES.put(Action.MORE,List.of("more","更多"));
  ALIASES.put(Action.USE,List.of("use","切換"));ALIASES.put(Action.REFRESH,List.of("refresh","同步"));
  ALIASES.put(Action.MESSAGES,List.of("message","messages","紀錄"));ALIASES.put(Action.OLDER,List.of("older","更早"));
  ALIASES.put(Action.STATUS,List.of("status","狀態"));ALIASES.put(Action.SOURCES,List.of("sources","來源"));
  ALIASES.put(Action.DELETE,List.of("delete","刪除"));ALIASES.put(Action.CONFIRM,List.of("confirm","確認刪除"));ALIASES.put(Action.KEEP,List.of("keep","保留"));
 }
 public static <S> void register(CommandDispatcher<S> dispatcher,Handler handler){
  for(String name:List.of("ai","小助手")){
   var root=LiteralArgumentBuilder.<S>literal(name).executes(c->{handler.action(Action.HELP,"");return 1;});
   for(var entry:ALIASES.entrySet())for(String alias:entry.getValue()){
    Action action=entry.getKey();var child=LiteralArgumentBuilder.<S>literal(alias);
    if(action==Action.ID){child.executes(c->{handler.action(action,"");return 1;});child.then(RequiredArgumentBuilder.<S,String>argument("name",StringArgumentType.greedyString()).executes(c->{handler.action(action,StringArgumentType.getString(c,"name"));return 1;}));}
    else if(action==Action.FIND)child.then(RequiredArgumentBuilder.<S,String>argument("entity",StringArgumentType.greedyString()).executes(c->{handler.action(action,StringArgumentType.getString(c,"entity"));return 1;}));
    else if(action==Action.USE||action==Action.CONFIRM)child.then(RequiredArgumentBuilder.<S,String>argument("conversation",StringArgumentType.word()).executes(c->{handler.action(action,StringArgumentType.getString(c,"conversation"));return 1;}));
    else if(action==Action.DELETE){child.executes(c->{handler.action(action,"");return 1;});child.then(RequiredArgumentBuilder.<S,String>argument("message",StringArgumentType.word()).executes(c->{handler.action(action,StringArgumentType.getString(c,"message"));return 1;}));}
    else if(action==Action.SOURCES){
     child.executes(c->{handler.action(action,"");return 1;});
     child.then(RequiredArgumentBuilder.<S,Integer>argument("reply",IntegerArgumentType.integer(1)).executes(c->{handler.action(action,String.valueOf(IntegerArgumentType.getInteger(c,"reply")));return 1;}));
    }else child.executes(c->{handler.action(action,"");return 1;});
    root.then(child);
   }
   for(String alias:List.of("ask","問"))root.then(LiteralArgumentBuilder.<S>literal(alias).then(RequiredArgumentBuilder.<S,String>argument("question",StringArgumentType.greedyString()).executes(c->{handler.question(StringArgumentType.getString(c,"question"));return 1;})));
   root.then(RequiredArgumentBuilder.<S,String>argument("question",StringArgumentType.greedyString()).executes(c->{handler.question(StringArgumentType.getString(c,"question"));return 1;}));
   dispatcher.register(root);
  }
 }
 public static boolean owns(String input){
  if(input==null)return false;
  String s=input.strip();if(!s.startsWith("/"))return false;
  int end=1;while(end<s.length()&&!Character.isWhitespace(s.charAt(end)))end++;
  String root=s.substring(1,end);return root.equalsIgnoreCase("ai")||root.equals("小助手");
 }
 public static String command(String input){
  if(!owns(input))throw new IllegalArgumentException("不是助手指令。");String s=input.strip().substring(1);
  return s.regionMatches(true,0,"ai",0,2)?"ai"+s.substring(2):s;
 }
 public static String clickedCommand(String action,String value){return "RUN_COMMAND".equals(action)&&owns(value)?value:null;}
 private CommandRoutes(){}
}
