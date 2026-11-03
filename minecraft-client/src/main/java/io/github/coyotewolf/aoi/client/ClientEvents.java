package io.github.coyotewolf.aoi.client;

import com.mojang.blaze3d.platform.InputConstants;
import io.github.coyotewolf.aoi.AoiAssistantMod;
import net.minecraft.client.*;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.ChatScreen;
import io.github.coyotewolf.aoi.client.commands.CommandImeBridge;
import net.minecraft.network.chat.Component;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.*;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.client.settings.KeyConflictContext;

@Mod.EventBusSubscriber(modid=AoiAssistantMod.ID,value=Dist.CLIENT,bus=Mod.EventBusSubscriber.Bus.FORGE)
public final class ClientEvents {
 private static boolean focused;
 public static final KeyMapping OPEN=new KeyMapping("key.aoi_assistant.open",KeyConflictContext.UNIVERSAL,InputConstants.Type.KEYSYM,InputConstants.UNKNOWN.getValue(),"key.categories.aoi_assistant");
 @SubscribeEvent public static void tick(TickEvent.ClientTickEvent event){
  if(event.phase!=TickEvent.Phase.END)return;
  var mc=Minecraft.getInstance();AnnouncementClient.tick();UpdateClient.tick();if(mc.level==null){CrosshairTarget.clear();GameScene.clear();}while(OPEN.consumeClick())if(mc.screen==null&&mc.player!=null)mc.setScreen(new ChatScreen("/ai "));
  boolean active=mc.isWindowActive();
  if(active&&!focused&&mc.screen instanceof AiAssistantScreen){var c=ChatController.get();if(c.service.view().loggedIn()&&!c.busy)c.run("正在同步雲端紀錄……",false,c.service::refresh);}
  focused=active;
  CommandImeBridge.tick();
 }
 @SubscribeEvent public static void sceneOpen(ScreenEvent.Opening event){GameScene.opening(event.getNewScreen(),Minecraft.getInstance().screen);}
 @SubscribeEvent public static void sceneRender(RenderLevelStageEvent event){GameScene.rendered(event);}
 @SubscribeEvent public static void sceneKey(ScreenEvent.KeyPressed.Pre event){
  var mc=Minecraft.getInstance();if(mc.player!=null&&!(event.getScreen() instanceof ChatScreen)&&OPEN.matches(event.getKeyCode(),event.getScanCode())&&(event.getScreen() instanceof net.minecraft.client.gui.screens.inventory.AbstractContainerScreen<?>||GameScene.jei().has("items"))){event.setCanceled(true);mc.setScreen(new ChatScreen("/ai "));}
 }
 @SubscribeEvent public static void title(ScreenEvent.Init.Post event){
  CrosshairTarget.opened(event.getScreen());
  if(event.getScreen() instanceof TitleScreen screen){
   ChatController.get();
   event.addListener(Button.builder(Component.literal("AI 小助手"),b->Minecraft.getInstance().setScreen(new AssistantLoginScreen(screen))).bounds(8,8,90,20).build());
  }
 }
 @SubscribeEvent public static void targetLabel(ScreenEvent.Render.Post event){
  if(!(event.getScreen() instanceof ChatScreen))return;
  String input=event.getScreen().children().stream().filter(net.minecraft.client.gui.components.EditBox.class::isInstance).map(net.minecraft.client.gui.components.EditBox.class::cast).map(net.minecraft.client.gui.components.EditBox::getValue).findFirst().orElse("");
  if(!io.github.coyotewolf.aoi.client.commands.CommandRoutes.owns(input))return;
  var mc=Minecraft.getInstance();var target=CrosshairTarget.current();
  String label=target==null?"AI 目標：未指向方塊或實體":"AI 目標（已固定）："+target.label();
  event.getGuiGraphics().fill(2,event.getScreen().height-42,event.getScreen().width-2,event.getScreen().height-28,0xC0101722);
  event.getGuiGraphics().drawString(mc.font,mc.font.plainSubstrByWidth(label,event.getScreen().width-8),4,event.getScreen().height-40,0xEDCB88,true);
  event.getGuiGraphics().fill(2,event.getScreen().height-55,event.getScreen().width-2,event.getScreen().height-43,0xC0101722);
  event.getGuiGraphics().drawString(mc.font,mc.font.plainSubstrByWidth(GameScene.summary(),event.getScreen().width-8),4,event.getScreen().height-54,0xADBACB,true);
 }
 @Mod.EventBusSubscriber(modid=AoiAssistantMod.ID,value=Dist.CLIENT,bus=Mod.EventBusSubscriber.Bus.MOD)
 public static class Registration {
  @SubscribeEvent public static void keys(RegisterKeyMappingsEvent e){e.register(OPEN);}
 }
}
