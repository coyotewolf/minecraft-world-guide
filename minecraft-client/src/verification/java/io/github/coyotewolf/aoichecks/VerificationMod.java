package io.github.coyotewolf.aoichecks;

import io.github.coyotewolf.aoi.client.*;
import io.github.coyotewolf.aoi.net.AssistantApi;
import io.github.coyotewolf.aoi.model.Models;
import net.minecraft.client.*;
import net.minecraft.client.gui.components.*;
import net.minecraft.client.gui.screens.*;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.fml.common.Mod;
import org.lwjgl.glfw.GLFW;
import java.nio.file.*;

@Mod("aoi_client_checks")
public final class VerificationMod {
 private int ticks,step;
 private int frames,lastFrame;
 private ChatController controller;
 private ClientChecks.Fake fake;
 private AiAssistantScreen screen;
 private String cid,other;
 private boolean preparing;
 public VerificationMod(){MinecraftForge.EVENT_BUS.addListener(this::tick);MinecraftForge.EVENT_BUS.addListener(this::frame);}
 private void frame(TickEvent.RenderTickEvent e){if(e.phase==TickEvent.Phase.END)frames++;}
 private void require(boolean value,String label){if(!value)throw new AssertionError(label);System.out.println("GUI PASS "+label);}
 private Button button(String text){return screen.children().stream().filter(Button.class::isInstance).map(Button.class::cast).filter(b->b.getMessage().getString().equals(text)).findFirst().orElseThrow();}
 private void image(String name)throws Exception{try(var image=Screenshot.takeScreenshot(Minecraft.getInstance().getMainRenderTarget())){image.writeToFile(Path.of(name+".png"));}}
 private void tick(TickEvent.ClientTickEvent event){
  if(event.phase!=TickEvent.Phase.END||++ticks%15!=0)return;var mc=Minecraft.getInstance();
  if(frames-lastFrame<3)return;lastFrame=frames;
  if(step==0&&mc.getOverlay()!=null)return;
  if(step==0&&!(mc.screen instanceof TitleScreen)){GLFW.glfwHideWindow(mc.getWindow().getWindow());mc.setScreen(new TitleScreen());return;}
  try{
   switch(step){
    case 0->{
     GLFW.glfwHideWindow(mc.getWindow().getWindow());
     require(mc.screen.children().stream().filter(Button.class::isInstance).map(Button.class::cast).anyMatch(b->b.getMessage().getString().equals("AI 小助手")),"main menu entry");
     require(ClientEvents.OPEN.isUnbound(),"default hotkey unbound");
     fake=new ClientChecks.Fake();var ctor=ChatController.class.getDeclaredConstructor(AssistantApi.class);ctor.setAccessible(true);controller=ctor.newInstance(ClientChecks.api(fake));
     var field=ChatController.class.getDeclaredField("instance");field.setAccessible(true);field.set(null,controller);
     mc.options.guiScale().set(2);mc.getWindow().setWindowed(1280,720);mc.resizeDisplay();
     mc.setScreen(new AssistantLoginScreen(null));step++;
    }
    case 1->{
     require(mc.screen instanceof AssistantLoginScreen,"default entry is credentials only");require(mc.screen.children().stream().noneMatch(MultiLineEditBox.class::isInstance),"login entry has no question page");
     var fields=mc.screen.children().stream().filter(EditBox.class::isInstance).map(EditBox.class::cast).toList();require(fields.size()==2,"login fields");fields.get(0).setValue("繁中測試帳號");fields.get(1).setValue("mock-password");step++;
    }
    case 2->{
     if(!preparing){image("gui-login-1280");mc.screen.children().stream().filter(Button.class::isInstance).map(Button.class::cast).filter(b->b.getMessage().getString().equals("登入並返回")).findFirst().orElseThrow().onPress();preparing=true;return;}
     if(controller.busy)return;require(controller.service.view().loggedIn(),"login returns with a valid session");require(!(mc.screen instanceof AssistantLoginScreen),"login closes after success");
     cid=Models.id();other=Models.id();fake.seed(cid,"跨裝置測試對話",ClientChecks.OWNER);fake.seed(other,"另一段對話",ClientChecks.OWNER);
     fake.seedMessage(cid,"user","龍族裝備要怎麼取得？\n請保留繁體中文與 English mod names。","2026-10-09T00:00:00Z");
     String mid=Models.id();var facts=new com.google.gson.JsonArray();facts.add(Models.obj("title","示範來源","playerSummary","此為介面測試資料，並非真實遊戲攻略。\n先準備材料，再確認條件。","source","測試資料","shard","fixture.json"));
     fake.messages.put(mid,new Models.Message(mid,cid,"assistant","這是一段介面測試回答。來源可展開，訊息可複製與刪除。\n網站與遊戲共用對話 UUID。",facts,"2026-10-09T00:00:01Z",true).row(ClientChecks.OWNER));
     controller.service.refreshHistory(false);controller.service.select(cid,()->{});controller.notice="雲端已同步（此畫面使用測試資料）。";
     controller.busy=true;mc.setScreen(screen=new AiAssistantScreen(null));controller.busy=false;step++;
    }
    case 3->{
     var input=screen.children().stream().filter(MultiLineEditBox.class::isInstance).map(MultiLineEditBox.class::cast).findFirst().orElseThrow();input.setValue("繁體中文草稿\n第二行 English");input.setFocused(true);screen.charTyped('龍',0);
     require(input.getValue().contains("龍")&&input.getValue().contains("\n"),"multiline Chinese and char input");
     screen.mouseClicked(30,145,0);button("來源").onPress();step++;
    }
    case 4->{
     image("gui-chat-1280");require(!screen.isPauseScreen(),"does not pause world");button("對話清單").onPress();step++;
    }
    case 5->{
     image("gui-history-1280");int index=0;for(var c:controller.service.view().conversations()){if(c.id().equals(other))break;index++;}
     screen.mouseClicked(Math.min(340,screen.width-16)-6,84+index*24+4,0);require(mc.screen instanceof ConfirmScreen,"delete confirmation");
     ((ConfirmScreen)mc.screen).children().stream().filter(Button.class::isInstance).map(Button.class::cast).filter(b->b.getMessage().getString().equals("刪除")).findFirst().orElseThrow().onPress();step++;
    }
    case 6->{
     if(controller.busy)return;
     require(!fake.conversations.containsKey(other)&&controller.service.view().conversationId().equals(cid),"delete another conversation preserves active");
     require(controller.drafts.get(cid).contains("繁體中文草稿"),"delete another conversation preserves draft");
     mc.getWindow().setWindowed(960,720);mc.options.guiScale().set(3);mc.resizeDisplay();step++;
    }
    case 7->{
     image("gui-chat-small");require(screen.width==320&&screen.height==240,"minimum logical GUI size");
     for(var child:screen.children())if(child instanceof AbstractWidget w)require(w.getX()>=0&&w.getY()>=0&&w.getX()+w.getWidth()<=screen.width&&w.getY()+w.getHeight()<=screen.height,"widget stays in viewport");
     screen.mouseScrolled(80,90,-6);screen.mouseClicked(25,90,0);String previous=mc.keyboardHandler.getClipboard();
     try{button("複製").onPress();String copied=mc.keyboardHandler.getClipboard();require(fake.messages.values().stream().anyMatch(m->m.get("text").getAsString().equals(copied)),"selected message copies to clipboard");}finally{mc.keyboardHandler.setClipboard(previous);}step++;
    }
    case 8->{
     image("gui-chat-small-scroll");screen.keyPressed(GLFW.GLFW_KEY_ESCAPE,0,0);require(mc.screen==null||mc.screen instanceof TitleScreen,"ESC returns to game or menu");
     Files.writeString(Path.of("gui-verification.json"),"{\"passed\":true,\"cloud\":\"mocked\",\"minecraft\":\"1.20.1\",\"forge\":\"47.4.23\",\"checks\":[\"menu\",\"unbound key\",\"login\",\"Chinese multiline\",\"sources\",\"history\",\"delete confirmation\",\"preserve active draft\",\"320x240\",\"scroll\",\"ESC\"]}");CommandUiChecks.start(fake);step++;
    }
    case 9->{
     if(controller.busy)return;CommandUiChecks.finish(fake);step++;
    }
    case 10->{
     image("gui-native-command-chat");CommandUiChecks.privacy();controller.shutdown();mc.stop();step++;
    }
   }
  }catch(Throwable error){
   try{Files.writeString(Path.of("gui-verification.json"),"{\"passed\":false,\"step\":"+step+",\"error\":\""+error.toString().replace("\"","'")+"\"}");}catch(Exception ignored){}
   error.printStackTrace();if(controller!=null)controller.shutdown();mc.stop();step=99;
  }
 }
}
