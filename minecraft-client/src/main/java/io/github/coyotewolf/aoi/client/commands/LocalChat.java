package io.github.coyotewolf.aoi.client.commands;

import net.minecraft.client.*;
import net.minecraft.client.gui.components.ChatComponent;
import net.minecraft.network.chat.*;
import java.lang.reflect.*;
import java.util.*;

/** Private HUD insertion bypasses vanilla's chat-to-log method. Never sends packets. */
public final class LocalChat {
 private static Method insertion;
 private static final Set<Component> owned=Collections.newSetFromMap(new IdentityHashMap<>());
 public static void add(Component text){
  var mc=Minecraft.getInstance();if(!mc.isSameThread())throw new IllegalStateException("聊天更新須在主執行緒。");
  try{
   if(insertion==null){
    Class<?>[] signature={Component.class,MessageSignature.class,int.class,GuiMessageTag.class,boolean.class};
    // Resolve by signature so both Mojang development names and Forge SRG names work.
    insertion=Arrays.stream(ChatComponent.class.getDeclaredMethods()).filter(m->Arrays.equals(m.getParameterTypes(),signature)).findFirst().orElseThrow();
    insertion.setAccessible(true);
   }
   insertion.invoke(mc.gui.getChat(),text,null,mc.gui.getGuiTicks(),GuiMessageTag.system(),false);owned.add(text);
   if(owned.size()>150){retainVisible();}
  }catch(ReflectiveOperationException|NoSuchElementException e){throw new IllegalStateException("無法顯示本機 AI 聊天。",e);}
 }
 private static void retainVisible()throws IllegalAccessException{
  var chat=Minecraft.getInstance().gui.getChat();var visible=Collections.newSetFromMap(new IdentityHashMap<Component,Boolean>());
  for(var f:ChatComponent.class.getDeclaredFields())if(f.getType()==List.class){f.setAccessible(true);Object value=f.get(chat);if(value instanceof List<?> list)for(Object row:list)if(row instanceof GuiMessage m)visible.add(m.content());}
  owned.retainAll(visible);
 }
 public static void clear(){
  var mc=Minecraft.getInstance();var chat=mc.gui.getChat();
  try{
   for(var f:ChatComponent.class.getDeclaredFields())if(f.getType()==List.class){
    f.setAccessible(true);Object value=f.get(chat);
    if(value instanceof List<?> list)list.removeIf(row->row instanceof GuiMessage m&&owned.contains(m.content()));
   }
   owned.clear();chat.getRecentChat().removeIf(CommandRoutes::owns);chat.rescaleChat();
  }catch(IllegalAccessException e){throw new IllegalStateException("無法清空本機 AI 聊天。",e);}
 }
 private LocalChat(){}
}
