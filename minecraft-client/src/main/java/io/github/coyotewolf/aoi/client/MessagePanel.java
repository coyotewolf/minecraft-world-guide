package io.github.coyotewolf.aoi.client;

import io.github.coyotewolf.aoi.model.Models;
import io.github.coyotewolf.aoi.model.Models.Message;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.Font;
import net.minecraft.network.chat.Component;
import net.minecraft.util.FormattedCharSequence;
import java.util.*;

/** Plain-text rendering only. Remote strings cannot create click actions. */
public final class MessagePanel {
 private record Hit(int top,int bottom,Message message) {}
 private final List<Hit> hits=new ArrayList<>();
 private final Set<String> expanded=new HashSet<>();
 private int scroll,total,viewport;
 private String selectedId="",cid="";
 private List<Message> cachedMessages=List.of();
 private List<List<FormattedCharSequence>> layouts=List.of();
 private int cachedWidth;
 private boolean dirty=true;
 public Message selected(List<Message> rows){return rows.stream().filter(m->m.id().equals(selectedId)).findFirst().orElse(null);}
 public void bottom(){scroll=Integer.MAX_VALUE;}
 public boolean scroll(double delta){scroll=Math.max(0,Math.min(Math.max(0,total-viewport),scroll-(int)(delta*32)));return true;}
 public void render(GuiGraphics g,Font font,List<Message> messages,String conversationId,int x,int y,int w,int h){
  if(!cid.equals(conversationId)){cid=conversationId;scroll=Integer.MAX_VALUE;selectedId="";expanded.clear();dirty=true;}
  viewport=h;hits.clear();
  if(dirty||cachedWidth!=w||cachedMessages!=messages){
  var nextLayouts=new ArrayList<List<FormattedCharSequence>>();total=0;
  for(Message m:messages){
   String text=(m.role().equals("user")?"你":"小助手")+(m.synced()?" · 已同步":" · 僅存本機")+"\n"+Models.safe(m.text(),8000);
   if(!m.facts().isEmpty()){
    text+="\n[來源 "+m.facts().size()+" 筆；選取後按來源展開]";
    if(expanded.contains(m.id())){
     int count=0;for(var fact:m.facts()){
      if(count++==12){text+="\n其餘來源已省略。";break;}
      // Preserve heterogeneous fact fields instead of inventing source/shard/line fields.
      if(fact.isJsonObject()){
       var f=fact.getAsJsonObject();
       text+="\n"+Models.safe(Models.text(f,"playerTitle",Models.text(f,"title","來源 "+count)),200);
       String summary=Models.text(f,"playerSummary",Models.text(f,"text",""));if(!summary.isBlank())text+="\n"+Models.safe(summary,2400);
       String source=Models.text(f,"source","");if(!source.isBlank())text+="\n依據："+Models.safe(source,600);
       String shard=Models.text(f,"shard","");if(!shard.isBlank())text+="\n資料檔："+Models.safe(shard,180);
       if(summary.isBlank()&&source.isBlank())text+="\n"+Models.safe(fact.toString(),1200);
      }else text+="\n"+Models.safe(fact.toString(),1200);
     }
    }
   }
   var lines=font.split(Component.literal(text),Math.max(30,w-20));nextLayouts.add(lines);total+=lines.size()*(font.lineHeight+3)+16;
  }
  layouts=nextLayouts;cachedMessages=messages;cachedWidth=w;dirty=false;
  }
  scroll=Math.max(0,Math.min(Math.max(0,total-h),scroll));
  g.fill(x,y,x+w,y+h,0xD0141E2B);g.enableScissor(x,y,x+w,y+h);int top=y-scroll;
  for(int i=0;i<messages.size();i++){
   Message m=messages.get(i);var lines=layouts.get(i);int height=lines.size()*(font.lineHeight+3)+16;
   hits.add(new Hit(top,top+height,m));
   if(top+height>=y&&top<=y+h){
    if(m.id().equals(selectedId))g.fill(x+2,top,x+w-2,top+height-3,0x80527693);
    int ty=top+6;for(var line:lines){if(ty+font.lineHeight>=y&&ty<y+h)g.drawString(font,line,x+8,ty,m.role().equals("user")?0xC9E4FF:0xF1F4F8,false);ty+=font.lineHeight+3;}
   }
   top+=height;
  }
  g.disableScissor();
  if(total>h){int thumb=Math.max(8,h*h/total),track=h-thumb;int offset=(int)((long)scroll*track/(total-h));g.fill(x+w-4,y+offset,x+w-1,y+offset+thumb,0xFF93A8BB);}
 }
 public boolean click(double mouseY){for(Hit hit:hits)if(mouseY>=hit.top&&mouseY<hit.bottom){selectedId=hit.message.id();return true;}return false;}
 public void sources(){if(!selectedId.isEmpty()){if(!expanded.add(selectedId))expanded.remove(selectedId);dirty=true;}}
}
