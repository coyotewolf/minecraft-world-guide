package io.github.coyotewolf.aoi.client;

import io.github.coyotewolf.aoi.model.Models;
import io.github.coyotewolf.aoi.model.Models.*;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.*;
import net.minecraft.client.gui.screens.*;
import net.minecraft.network.chat.Component;
import org.lwjgl.glfw.GLFW;
import java.net.URI;
import java.util.*;

public final class AiAssistantScreen extends Screen {
 private final Screen parent;
 private final com.google.gson.JsonObject scene;
 private final io.github.coyotewolf.aoi.model.TargetQuestion target=CrosshairTarget.capture();
 private final ChatController controller;
 private final MessagePanel panel=new MessagePanel();
 private MultiLineEditBox input;
 private EditBox gameId,password;
 private final List<Button> controls=new ArrayList<>();
 private Button send,retry,older,history,statusButton,cancel,logout,newChat,refresh,sources,copy,delete;
 private String layoutCid="";
 private String sentDraft="",sentCid="";
 private String sentPrepared="";
 private boolean layoutLogged;
 private int historyOffset,historyScroll;
 private boolean historyOpen;
 private final List<Conversation> visibleHistory=new ArrayList<>();
 private int px,py,pw,ph;
 private static final URI WEBSITE=URI.create("https://coyotewolf.github.io/minecraft-world-guide/");
 public AiAssistantScreen(Screen parent){
  super(Component.literal("王國飛翼 AI 小助手"));this.parent=parent;scene=GameScene.capture(parent);controller=ChatController.get();
  if(controller.service.view().loggedIn()&&!controller.busy)controller.run("正在同步雲端紀錄……",false,controller.service::refresh);
 }
 private Button button(String label,int x,int y,int w,Runnable action){var b=Button.builder(Component.literal(label),ignored->action.run()).bounds(x,y,w,20).build();controls.add(b);return addRenderableWidget(b);}
 private void saveDraft(){if(input!=null)controller.drafts.put(layoutCid,input.getValue());}
 @Override protected void init(){
  saveDraft();controls.clear();input=null;gameId=null;password=null;
  var view=controller.service.view();layoutCid=view.conversationId();layoutLogged=view.loggedIn();
  button("關閉",width-54,8,46,this::onClose);
  if(!layoutLogged){
   int w=Math.min(300,width-40),x=(width-w)/2,y=Math.max(65,height/2-55);
   gameId=addRenderableWidget(new EditBox(font,x,y,w,20,Component.literal("遊戲 ID")));gameId.setMaxLength(32);gameId.setHint(Component.literal("網站遊戲 ID"));
   password=addRenderableWidget(new EditBox(font,x,y+28,w,20,Component.literal("網站專用密碼")));password.setMaxLength(72);password.setHint(Component.literal("網站專用密碼"));password.setFormatter((text,cursor)->net.minecraft.util.FormattedCharSequence.forward("•".repeat(text.length()),net.minecraft.network.chat.Style.EMPTY));
   button("登入",x,y+56,w,()->{
    String name=gameId.getValue(),secret=password.getValue();password.setValue("");
    controller.run("正在登入……",false,check->{controller.service.login(name,secret,check);check.run();controller.drafts.clear();});
   });
   button("開啟攻略網站",x,y+84,w,()->minecraft.setScreen(new ConfirmLinkScreen(ok->{if(ok)net.minecraft.Util.getPlatform().openUri(WEBSITE);minecraft.setScreen(this);},WEBSITE.toString(),true)));
   setInitialFocus(gameId);return;
  }
  int margin=8,gap=4,w=Math.max(40,(width-2*margin-4*gap)/5),y=34;
  newChat=button("新對話",margin,y,w,()->{saveDraft();controller.run("建立新對話……",false,c->controller.service.newConversation());});
  history=button("對話清單",margin+(w+gap),y,w,()->{historyOpen=!historyOpen;historyOffset=0;historyScroll=0;});
  refresh=button("重新整理",margin+2*(w+gap),y,w,()->controller.run("正在同步……",false,controller.service::refresh));
  statusButton=button("服務狀態",margin+3*(w+gap),y,w,()->controller.run("查詢服務……",false,c->controller.service.availability()));
  logout=button("登出",margin+4*(w+gap),y,w,()->{saveDraft();controller.logout();});
  px=8;py=60;pw=width-16;ph=Math.max(30,height-178);
  int rowY=height-112,small=Math.max(35,(width-16-4*gap)/5);
  older=button("更早訊息",8,rowY,small,()->controller.run("載入歷史……",false,controller.service::older));
  sources=button("來源",8+(small+gap),rowY,small,panel::sources);
  copy=button("複製",8+2*(small+gap),rowY,small,()->{Message m=panel.selected(controller.service.view().messages());if(m!=null)minecraft.keyboardHandler.setClipboard(m.text());});
  delete=button("刪訊息",8+3*(small+gap),rowY,small,()->{Message m=panel.selected(controller.service.view().messages());if(m!=null)confirmDelete(layoutCid,m.id());});
  button("刪對話",8+4*(small+gap),rowY,small,()->confirmDelete(layoutCid,null));
  int bw=62,iw=Math.max(70,width-24-bw);
  input=addRenderableWidget(new MultiLineEditBox(font,8,height-84,iw,48,Component.literal("問題"),Component.literal("輸入 1～600 字；Ctrl+Enter 傳送")));
  input.setCharacterLimit(600);input.setValue(controller.drafts.getOrDefault(layoutCid,""));
  send=button("傳送",width-8-bw,height-84,bw,this::send);
  retry=button("重試",width-8-bw,height-60,bw,()->controller.run("正在重試相同訊息……",false,controller.service::retry));
  cancel=button("取消等待",width-8-bw,height-36,bw,controller::cancel);
  setInitialFocus(input);
 }
 private void send(){
  if(input==null||controller.busy)return;
  String question=input.getValue();if(question.isBlank()){controller.notice="請先輸入問題。";return;}
  String prepared;
  prepared=question;
  saveDraft();sentDraft=question;sentPrepared=prepared.trim();sentCid=layoutCid;panel.bottom();var requestScene=GameScene.withPlayerContext(scene,parent);controller.run("正在提問……",false,check->controller.service.send(prepared,requestScene,check));
  // Keep draft until a user message with this text is actually accepted locally.
 }
 private void confirmDelete(String cid,String mid){
  if(controller.busy)return;saveDraft();historyOpen=false;
  String detail=mid==null?"將從網站及遊戲帳號刪除整段對話，無法復原。":"將刪除這則訊息並清除這段對話的 AI 暫存。";
  minecraft.setScreen(new ConfirmScreen(ok->{
   minecraft.setScreen(this);
   if(ok)controller.run("正在刪除……",true,check->{controller.service.delete(cid,mid,check);if(mid==null)controller.drafts.remove(cid);});
  },Component.literal("確定刪除？"),Component.literal(detail),Component.literal("刪除"),Component.literal("保留")));
 }
 @Override public void tick(){
  if(gameId!=null)gameId.tick();if(password!=null)password.tick();
  var view=controller.service.view();
  if(view.loggedIn()!=layoutLogged||!view.conversationId().equals(layoutCid)){saveDraft();historyOpen=false;rebuildWidgets();}
  for(Button b:controls)b.active=!controller.busy;
  if(layoutLogged){
   boolean ready=!controller.busy&&view.loggedIn();
   send.active=ready&&!view.retry()&&input!=null&&!input.getValue().isBlank();retry.active=ready&&view.retry();older.active=ready&&view.earlier();
   boolean selected=panel.selected(view.messages())!=null;sources.active=ready&&selected;copy.active=selected;delete.active=ready&&selected;
   cancel.active=controller.busy&&!controller.deleting;
   // Closing the screen is always available, including during network waits.
   controls.get(0).active=true;
   logout.active=!controller.deleting;
   if(input!=null){
    input.tick();
    if(!controller.busy&&!view.retry()&&layoutCid.equals(sentCid)&&!sentDraft.isBlank()&&view.messages().stream().anyMatch(m->m.role().equals("user")&&m.text().equals(sentPrepared))){
     if(input.getValue().equals(sentDraft))input.setValue("");sentDraft="";
    }
    saveDraft();
   }
  }else if(!controls.isEmpty())controls.get(0).active=true;
 }
 @Override public void render(GuiGraphics g,int mouseX,int mouseY,float partialTick){
  renderBackground(g);g.fill(0,0,width,height,0xC0101722);
  g.drawString(font,title,10,12,0xF1E0BC,false);
  var view=controller.service.view();
  if(layoutLogged){
   panel.render(g,font,view.messages(),layoutCid,px,py,pw,ph);
   String selected=view.conversations().stream().filter(c->c.id().equals(layoutCid)).map(Conversation::title).findFirst().orElse("新對話");
   if(view.messages().isEmpty())g.drawString(font,"選擇既有對話，或直接輸入問題。",16,py+12,0xADBACB,false);
   String heading=target==null?Models.safe(selected,40):"目標："+target.label();
   g.drawString(font,font.plainSubstrByWidth(heading,width-20),10,24,0xC9D4E1,false);
  }else{
   String msg="使用網站專用密碼。登入後會記住帳號，重開遊戲自動恢復；登出會清除記住的登入。";
   int y=38;for(var line:font.split(Component.literal(msg),width-32)){g.drawString(font,line,16,y,0xC8D2E0,false);y+=12;}
  }
  super.render(g,mouseX,mouseY,partialTick);
  String notice=controller.notice.isBlank()?view.status():controller.notice;
  int ny=height-24;for(var line:font.split(Component.literal(Models.safe(notice,160)),Math.max(60,width-90))){g.drawString(font,line,8,ny,0xEDCB88,false);ny+=10;if(ny>=height-2)break;}
  if(mouseY>=height-24&&mouseX<width-85&&!notice.isBlank())g.renderTooltip(font,Component.literal(notice),mouseX,mouseY);
  if(historyOpen&&layoutLogged){g.pose().pushPose();g.pose().translate(0,0,300);renderHistory(g,view);g.pose().popPose();}
 }
 private void renderHistory(GuiGraphics g,io.github.coyotewolf.aoi.sync.ChatSyncService.View view){
  int x=8,y=60,w=Math.min(340,width-16),h=ph,rows=Math.max(1,(h-28)/24);
  historyOffset=Math.max(0,Math.min(Math.max(0,view.conversations().size()-rows),historyScroll));visibleHistory.clear();
  g.fill(x,y,x+w,y+h,0xFF243247);g.drawString(font,"對話 · 滾輪捲動 · × 刪除",x+6,y+5,0xFFE6C5,false);
  int iy=y+24;
  for(int i=historyOffset;i<Math.min(view.conversations().size(),historyOffset+rows);i++){
   var c=view.conversations().get(i);visibleHistory.add(c);g.drawString(font,font.plainSubstrByWidth(c.title(),w-40),x+6,iy+4,0xFFFFFF,false);g.drawString(font,"×",x+w-16,iy+4,0xFFAAAA,false);iy+=24;
  }
  if(view.moreConversations())g.drawString(font,"點此載入更多對話",x+6,y+h-12,0x8FCEFA,false);
 }
 @Override public boolean mouseClicked(double x,double y,int button){
  if(historyOpen){
   int w=Math.min(340,width-16),h=ph;
   if(x>=8&&x<8+w&&y>=60&&y<60+h){
    if(controller.busy)return true;
    if(y>=60+h-16&&controller.service.view().moreConversations()){controller.run("載入對話……",false,c->{controller.service.refreshHistory(true);controller.service.publish("已載入更多對話。");});return true;}
    int index=(int)((y-84)/24);if(y>=84&&index>=0&&index<visibleHistory.size()){
     var c=visibleHistory.get(index);if(x>=8+w-24)confirmDelete(c.id(),null);
     else {saveDraft();historyOpen=false;controller.run("載入對話……",false,check->controller.service.select(c.id(),check));}
    }return true;
   }
   historyOpen=false;return true;
  }
  if(layoutLogged&&x>=px&&x<px+pw&&y>=py&&y<py+ph&&button==0)return panel.click(y);
  return super.mouseClicked(x,y,button);
 }
 @Override public boolean mouseScrolled(double x,double y,double delta){
  if(historyOpen){historyScroll=Math.max(0,historyScroll-(int)(delta*3));return true;}
  if(layoutLogged&&x>=px&&x<px+pw&&y>=py&&y<py+ph)return panel.scroll(delta);
  return super.mouseScrolled(x,y,delta);
 }
 @Override public boolean keyPressed(int key,int scan,int mods){
  if(key==GLFW.GLFW_KEY_ENTER&&hasControlDown()&&layoutLogged){send();return true;}
  if(key==GLFW.GLFW_KEY_ESCAPE){onClose();return true;}
  return super.keyPressed(key,scan,mods);
 }
 @Override public void onClose(){saveDraft();minecraft.setScreen(parent);}
 @Override public void removed(){saveDraft();if(password!=null)password.setValue("");}
 @Override public boolean isPauseScreen(){return false;}
}
