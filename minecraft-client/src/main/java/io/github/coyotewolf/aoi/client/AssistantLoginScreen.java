package io.github.coyotewolf.aoi.client;

import io.github.coyotewolf.aoi.client.commands.ChatCommands;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.*;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.*;
import net.minecraft.util.FormattedCharSequence;

/** Credential entry only. Questions and answers use Minecraft's ordinary chat. */
public final class AssistantLoginScreen extends Screen {
 private final Screen parent;
 private final ChatController controller=ChatController.get();
 private EditBox name,password;
 private Button login;
 private boolean signingIn;
 public AssistantLoginScreen(Screen parent){super(Component.literal("連接攻略帳號"));this.parent=parent;}
 @Override protected void init(){
  int w=Math.min(300,width-32),x=(width-w)/2,y=Math.max(80,height/2-42);
  addRenderableWidget(Button.builder(Component.literal("返回遊戲"),b->onClose()).bounds(width-88,8,80,20).build());
  if(controller.service.view().loggedIn()){
   addRenderableWidget(Button.builder(Component.literal("返回，用 /ai 問問題"),b->onClose()).bounds(x,y,w,20).build());return;
  }
  name=addRenderableWidget(new EditBox(font,x,y,w,20,Component.literal("網站遊戲 ID")));name.setHint(Component.literal("網站遊戲 ID"));name.setMaxLength(32);
  password=addRenderableWidget(new EditBox(font,x,y+28,w,20,Component.literal("網站專用密碼")));password.setHint(Component.literal("網站專用密碼"));password.setMaxLength(72);
  password.setFormatter((text,cursor)->FormattedCharSequence.forward("•".repeat(text.length()),Style.EMPTY));
  login=addRenderableWidget(Button.builder(Component.literal("登入並返回"),b->{
   if(controller.busy)return;String account=name.getValue(),secret=password.getValue();password.setValue("");signingIn=true;
   controller.run("正在登入……",false,check->{controller.service.login(account,secret,check);check.run();controller.drafts.clear();},r->{
    signingIn=false;if(r.view().loggedIn()){if(minecraft.screen==this)minecraft.setScreen(parent);ChatCommands.loginReady();if(!r.success())ChatCommands.say(r.status());}
   });
  }).bounds(x,y+56,w,20).build());setInitialFocus(name);
 }
 @Override public void tick(){if(name!=null)name.tick();if(password!=null)password.tick();if(login!=null)login.active=!controller.busy;}
 @Override public void render(GuiGraphics g,int mx,int my,float frame){
  renderBackground(g);g.fill(0,0,width,height,0xD0101722);g.drawCenteredString(font,title,width/2,24,0xF1E0BC);
  int y=46;for(var line:font.split(Component.literal("登入後會記住帳號，重開遊戲自動恢復；密碼不儲存。用 /ai 登出 清除記住的登入。"),width-32)){g.drawString(font,line,16,y,0xD0D8E3,false);y+=12;}
  super.render(g,mx,my,frame);String status=!controller.notice.isBlank()?controller.notice:controller.service.view().loggedIn()?"攻略帳號已登入。":"請登入攻略帳號。";
  y=height-28;for(var line:font.split(Component.literal(status),width-32)){g.drawString(font,line,16,y,0xEAC789,false);y+=10;if(y>=height-2)break;}
 }
 @Override public void onClose(){if(signingIn)controller.cancel();if(password!=null)password.setValue("");minecraft.setScreen(parent);}
 @Override public void removed(){if(password!=null)password.setValue("");}
 @Override public boolean isPauseScreen(){return false;}
}
