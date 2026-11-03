package io.github.coyotewolf.aoi.client;

import io.github.coyotewolf.aoi.model.TargetQuestion;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.ChatScreen;
import net.minecraft.world.phys.*;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraftforge.registries.ForgeRegistries;
import java.util.WeakHashMap;

public final class CrosshairTarget {
 private record Snapshot(ClientLevel level,TargetQuestion target){}
 private static final WeakHashMap<Screen,Snapshot> snapshots=new WeakHashMap<>();
 private static Snapshot chat;
 public static TargetQuestion capture(){
  var mc=Minecraft.getInstance();if(mc.level==null||mc.player==null)return null;
  // Dropped items are not included in vanilla's pickable-entity hit result.
  // Clip their bounds along the same sight ray, stopping at blocks/other targets.
  var camera=mc.getCameraEntity();
  if(camera!=null&&mc.gameMode!=null){
   float frame=mc.getFrameTime();double reach=mc.gameMode.getPickRange();
   Vec3 start=camera.getEyePosition(frame),direction=camera.getViewVector(frame).scale(reach),end=start.add(direction);
   double nearest=camera.pick(reach,frame,false).getLocation().distanceToSqr(start);
   if(mc.hitResult!=null&&mc.hitResult.getType()!=HitResult.Type.MISS)nearest=Math.min(nearest,mc.hitResult.getLocation().distanceToSqr(start));
   ItemEntity selected=null;
   for(var drop:mc.level.getEntitiesOfClass(ItemEntity.class,camera.getBoundingBox().expandTowards(direction).inflate(1),e->!e.isRemoved()&&!e.getItem().isEmpty())){
    var bounds=drop.getBoundingBox();var intersection=bounds.clip(start,end);
    if(bounds.contains(start)||intersection.isPresent()){
     double distance=bounds.contains(start)?0:intersection.get().distanceToSqr(start);
     if(distance<nearest){nearest=distance;selected=drop;}
    }
   }
   if(selected!=null)return item(selected);
  }
  if(mc.hitResult instanceof BlockHitResult hit&&hit.getType()==HitResult.Type.BLOCK){
   var state=mc.level.getBlockState(hit.getBlockPos());if(state.isAir())return null;
   var block=state.getBlock();var id=ForgeRegistries.BLOCKS.getKey(block);
   return id==null?null:new TargetQuestion("方塊",block.getName().getString(),id.toString());
  }
  if(mc.hitResult instanceof EntityHitResult hit){
   var entity=hit.getEntity();
   if(entity instanceof ItemEntity drop){
    return item(drop);
   }
   var id=ForgeRegistries.ENTITY_TYPES.getKey(entity.getType());
   return id==null?null:new TargetQuestion("實體",entity.getType().getDescription().getString(),id.toString());
  }
  return null;
 }
 private static TargetQuestion item(ItemEntity drop){
  var stack=drop.getItem();var id=ForgeRegistries.ITEMS.getKey(stack.getItem());
  return stack.isEmpty()||id==null?null:new TargetQuestion("掉落物",stack.getItem().getDescription().getString(),id.toString());
 }
 public static void opened(Screen screen){
  if(!(screen instanceof ChatScreen))return;
  // Resizing/reinitializing the same chat screen must keep its original target.
  chat=snapshots.computeIfAbsent(screen,s->new Snapshot(Minecraft.getInstance().level,capture()));
 }
 public static TargetQuestion current(){return chat!=null&&chat.level==Minecraft.getInstance().level?chat.target:null;}
 public static void clear(){chat=null;snapshots.clear();}
 private CrosshairTarget(){}
}
