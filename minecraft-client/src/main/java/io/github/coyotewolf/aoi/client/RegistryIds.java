package io.github.coyotewolf.aoi.client;
import io.github.coyotewolf.aoi.model.*;import net.minecraft.client.Minecraft;import net.minecraft.world.phys.*;import net.minecraftforge.registries.ForgeRegistries;import java.util.*;import java.util.concurrent.TimeUnit;
public final class RegistryIds {
 private static final Map<String,String> LABELS=Map.of("item","物品","block","方塊","entity","實體");
 public static String find(RegistryQuery query){var mc=Minecraft.getInstance();if(!mc.isSameThread())throw new IllegalStateException("須在遊戲主執行緒查詢。");
  if(query.query().equals("@hand")||query.query().equals("@target")){
   if(mc.player==null||mc.level==null)return "請進入世界後查詢目標或手持物品的 ID。";
   if(query.query().equals("@target")){
    if(mc.hitResult instanceof EntityHitResult hit&&hit.getEntity().isAlive())return "實體「"+hit.getEntity().getType().getDescription().getString()+"」完整 ID："+ForgeRegistries.ENTITY_TYPES.getKey(hit.getEntity().getType());
    if(mc.hitResult instanceof BlockHitResult hit&&hit.getType()==HitResult.Type.BLOCK){var block=mc.level.getBlockState(hit.getBlockPos()).getBlock();return "方塊「"+block.getName().getString()+"」完整 ID："+ForgeRegistries.BLOCKS.getKey(block);}
   }
   var stack=mc.player.getMainHandItem();if(stack.isEmpty())return "沒有指向方塊或實體，主手也沒有物品。可用 /ai id 名稱 查詢，或 /ai id 手持。";
   return "手持物品「"+stack.getHoverName().getString()+"」完整 ID："+ForgeRegistries.ITEMS.getKey(stack.getItem())+"。這是註冊 ID，不包含 NBT／附加資料。";
  }
  var entries=new ArrayList<RegistryLookup.Entry>();
  for(var item:ForgeRegistries.ITEMS.getValues()){var id=ForgeRegistries.ITEMS.getKey(item);if(id!=null)entries.add(new RegistryLookup.Entry("item",id.toString(),item.getDescription().getString()));}
  for(var block:ForgeRegistries.BLOCKS.getValues()){var id=ForgeRegistries.BLOCKS.getKey(block);if(id!=null)entries.add(new RegistryLookup.Entry("block",id.toString(),block.getName().getString()));}
  for(var entity:ForgeRegistries.ENTITY_TYPES.getValues()){var id=ForgeRegistries.ENTITY_TYPES.getKey(entity);if(id!=null)entries.add(new RegistryLookup.Entry("entity",id.toString(),entity.getDescription().getString()));}
  var found=RegistryLookup.search(query,entries);if(found.isEmpty())return "目前整合包的物品、方塊、實體註冊表中找不到「"+Models.safe(query.query(),160)+"」。可換名稱、名稱片段或模組英文 ID；不會猜測不存在的 ID。";
  return "目前整合包完整 ID（共"+found.size()+"項）：\n"+found.stream().limit(20).map(e->LABELS.get(e.kind())+"「"+e.name()+"」："+e.id()).reduce((a,b)->a+"\n"+b).orElse("")+(found.size()>20?"\n只列前20項；請增加名稱片段，或指定物品／方塊／實體縮小查詢。":"");
 }
 public static String fromAi(RegistryQuery query){var mc=Minecraft.getInstance();var level=mc.level;var player=mc.player;try{return mc.submit(()->{if(mc.level!=level||mc.player!=player)throw new IllegalStateException("世界已切換");return find(query);}).get(10,TimeUnit.SECONDS);}catch(Exception e){throw new IllegalStateException("ID 查詢未完成，請重新提問。",e);}}
 private RegistryIds(){}
}
