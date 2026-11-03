package io.github.coyotewolf.aoichecks;

import io.github.coyotewolf.aoi.client.*;
import io.github.coyotewolf.aoi.client.commands.*;
import io.github.coyotewolf.aoi.model.Models;
import net.minecraft.client.*;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.*;
import net.minecraft.client.gui.screens.ChatScreen;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.network.chat.Component;
import net.minecraftforge.client.event.*;
import net.minecraftforge.common.MinecraftForge;
import com.mojang.brigadier.CommandDispatcher;
import org.lwjgl.glfw.GLFW;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.*;

public final class CommandUiChecks {
 private static final String PRIVATE="PRIVATE_AI_SENTINEL",PUBLIC="PUBLIC_CHAT_SENTINEL";
 public static class TestChat extends ChatScreen {
  private final String initial;
  private EditBox box;
  public TestChat(String initial){super("");this.initial=initial;}
  @Override protected void init(){input=box=addRenderableWidget(new EditBox(font,4,height-18,width-8,14,Component.literal("聊天")));box.setMaxLength(256);box.setValue(initial);setInitialFocus(box);}
  @Override public void render(GuiGraphics g,int mx,int my,float frame){g.fill(0,0,width,height,0xFF142130);g.drawString(font,"原版聊天欄與本機 /ai 回答（測試資料）",8,8,0xDFE6F0);minecraft.gui.getChat().render(g,minecraft.gui.getGuiTicks(),mx,my);box.render(g,mx,my,frame);}
 }
 private static void require(boolean ok,String label){if(!ok)throw new AssertionError(label);System.out.println("COMMAND GUI PASS "+label);}
 public static List<GuiMessage> rows()throws Exception{
  var chat=Minecraft.getInstance().gui.getChat();var rows=new ArrayList<GuiMessage>();
  for(Field f:ChatComponent.class.getDeclaredFields())if(f.getType()==List.class){f.setAccessible(true);Object value=f.get(chat);if(value instanceof List<?> list)for(Object row:list)if(row instanceof GuiMessage message)rows.add(message);}
  return rows;
 }
 public static void start(ClientChecks.Fake fake)throws Exception{
  var mc=Minecraft.getInstance();mc.getWindow().setWindowed(1280,720);mc.options.guiScale().set(2);mc.resizeDisplay();
  var dispatcher=new CommandDispatcher<CommandSourceStack>();MinecraftForge.EVENT_BUS.post(new RegisterClientCommandsEvent(dispatcher,null));
  require(dispatcher.getRoot().getChild("ai")!=null&&dispatcher.getRoot().getChild("小助手")!=null,"Forge client command registration");
  ChatCommands.clearLocal();mc.gui.getChat().addMessage(Component.literal(PUBLIC));LocalChat.add(Component.literal(PRIVATE));
  fake.onAsk=()->{var facts=new com.google.gson.JsonArray();facts.add(Models.obj("title","來源測試","playerSummary","此為私密聊天來源的介面測試。","source","測試資料"));fake.answers.get(fake.requestIds.get(fake.requestIds.size()-1)).add("facts",facts);};
  var screen=new TestChat("/ai PRIVATE_AI_QUESTION 繁中問題 English mod names");mc.setScreen(screen);
  var e=new ScreenEvent.KeyPressed.Pre(screen,GLFW.GLFW_KEY_ENTER,0,0);MinecraftForge.EVENT_BUS.post(e);
  require(e.isCanceled(),"Enter intercepted before packet transport");require(!(mc.screen instanceof AiAssistantScreen)&&!(mc.screen instanceof AssistantLoginScreen),"logged-in question never opens separate assistant page");
 }
 public static void finish(ClientChecks.Fake fake)throws Exception{
  require(fake.generated==1,"one slash question uses existing backend exactly once");
  require(rows().stream().anyMatch(m->m.content().getString().contains("測試回答")),"reply appears in native chat");
  require(rows().stream().noneMatch(m->{String text=m.content().getString();return text.contains("[來源 ")||text.contains("[複製回答]")||text.contains("[刪除此回覆]");}),"reply has no source copy or delete footer");
  ChatCommands.submit("/ai 來源 1");require(rows().stream().anyMatch(m->m.content().getString().contains("來源測試")),"source expands in same chat");
  var mc=Minecraft.getInstance();var ordinary=new TestChat("普通伺服器聊天");mc.setScreen(ordinary);var e=new ScreenEvent.KeyPressed.Pre(ordinary,GLFW.GLFW_KEY_ENTER,0,0);MinecraftForge.EVENT_BUS.post(e);require(!e.isCanceled(),"ordinary chat remains unchanged");
  var invalid=new TestChat("/ai login mock-password");mc.setScreen(invalid);e=new ScreenEvent.KeyPressed.Pre(invalid,GLFW.GLFW_KEY_ENTER,0,0);MinecraftForge.EVENT_BUS.post(e);require(e.isCanceled(),"malformed login is not forwarded");
  require(mc.gui.getChat().getRecentChat().stream().noneMatch(s->s.contains("mock-password")),"password never enters command recall history");
  mc.setScreen(new TestChat("/ai 下一個問題"));
 }
 public static void privacy()throws Exception{
  String logs=Files.readString(Path.of("logs/latest.log"));
  require(logs.contains(PUBLIC),"vanilla ordinary chat logging fixture present");
  require(!logs.contains(PRIVATE)&&!logs.contains("PRIVATE_AI_QUESTION"),"private AI text bypasses Minecraft chat logger");
  LocalChat.clear();require(rows().stream().noneMatch(m->m.content().getString().contains(PRIVATE)||m.content().getString().startsWith("[AI]")),"clear removes only owned AI messages");
  require(rows().stream().anyMatch(m->m.content().getString().equals(PUBLIC)),"ordinary chat survives AI clear");
  Files.writeString(Path.of("command-ui-verification.json"),"{\"passed\":true,\"cloud\":\"mocked\",\"checks\":[\"Forge registration\",\"Enter capture\",\"native chat reply\",\"sources\",\"no question page\",\"malformed login captured\",\"no password recall\",\"private text not logged\",\"ordinary chat preserved\"]}");
 }
 private CommandUiChecks(){}
}
