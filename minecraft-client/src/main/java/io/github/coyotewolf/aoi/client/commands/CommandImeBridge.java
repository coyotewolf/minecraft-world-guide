package io.github.coyotewolf.aoi.client.commands;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.ChatScreen;
import net.minecraftforge.fml.ModList;
import java.lang.reflect.*;

/** Optional ContingameIME 1.0.7 adapter using its existing public edit-state API. */
public final class CommandImeBridge {
 private static final ImeCommandPolicy policy=new ImeCommandPolicy();
 private static boolean checked,available;
 private static Object config,companion,open,closed;
 private static Method disabled,onEdit;
 private static void initialize()throws ReflectiveOperationException{
  checked=true;if(!ModList.get().isLoaded("ingameime"))return;
  String pkg="city.windmill.ingameime.client.handler.";
  var cfg=Class.forName(pkg+"ConfigHandler");config=cfg.getField("INSTANCE").get(null);disabled=cfg.getMethod("getDisableIMEInCommandMode");
  var edit=Class.forName(pkg+"ScreenHandler$ScreenState$EditState");open=edit.getField("EDIT_OPEN").get(null);closed=edit.getField("NULL_EDIT").get(null);
  var ime=Class.forName(pkg+"IMEHandler$IMEState");companion=ime.getField("Companion").get(null);onEdit=companion.getClass().getMethod("onEditState",edit);available=true;
 }
 public static void tick(){
  var mc=Minecraft.getInstance();if(!(mc.screen instanceof ChatScreen screen)){policy.reset();return;}
  try{
   if(!checked)initialize();if(!available)return;
   var box=screen.children().stream().filter(EditBox.class::isInstance).map(EditBox.class::cast).filter(EditBox::isFocused).findFirst().orElse(null);
   if(box==null){policy.reset();return;}
   boolean blocked=(boolean)disabled.invoke(config);
   policy.update(box.getValue(),box.getCursorPosition(),blocked,editing->{
    try{onEdit.invoke(companion,editing?open:closed);}catch(ReflectiveOperationException e){throw new IllegalStateException(e);}
   });
  }catch(ReflectiveOperationException|LinkageError|IllegalStateException e){
   available=false;checked=true;policy.reset();ChatCommands.say("中文輸入相容模式無法啟用；可以先貼上文字提問。");
  }
 }
 private CommandImeBridge(){}
}
