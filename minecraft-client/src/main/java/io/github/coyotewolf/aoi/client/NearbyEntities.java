package io.github.coyotewolf.aoi.client;
import io.github.coyotewolf.aoi.model.*;import net.minecraft.client.Minecraft;import net.minecraft.world.entity.item.ItemEntity;import net.minecraftforge.registries.ForgeRegistries;import java.util.*;import java.util.concurrent.TimeUnit;
/** One-shot scan of all synchronized entities. No frustum, raycast or chunk loads. */
public final class NearbyEntities {
 public static String find(NearbyQuery query){
  var mc=Minecraft.getInstance();if(!mc.isSameThread())throw new IllegalStateException("須在遊戲主執行緒搜尋。");
  if(mc.player==null||mc.level==null)return "請進入世界後搜尋附近實體。";
  var candidates=new ArrayList<NearbySearch.Candidate>();
  for(var entity:mc.level.entitiesForRendering()){
   if(entity==mc.player||!entity.isAlive()||entity.isRemoved())continue;
   var key=ForgeRegistries.ENTITY_TYPES.getKey(entity.getType());if(key==null)continue;
   String extra=entity.getType().getDescription().getString();
   if(entity instanceof ItemEntity item){var itemId=ForgeRegistries.ITEMS.getKey(item.getItem().getItem());extra+=" "+item.getItem().getHoverName().getString()+" "+itemId;}
   candidates.add(new NearbySearch.Candidate(key.toString(),Models.safe(entity.getName().getString(),80),Models.safe(extra,200),entity.getX(),entity.getY(),entity.getZ()));
  }
  var terms=new ArrayList<String>();for(String term:query.query().split("[,，、]")){var exact=new ArrayList<String>();for(var type:ForgeRegistries.ENTITY_TYPES.getValues())if(type.getDescription().getString().equalsIgnoreCase(term.strip())){var key=ForgeRegistries.ENTITY_TYPES.getKey(type);if(key!=null)exact.add(key.toString());}if(exact.isEmpty())terms.add(term.strip());else terms.addAll(exact);}
  var resolved=new NearbyQuery(String.join(",",terms),query.radius());
  var found=NearbySearch.search(resolved,mc.player.getX(),mc.player.getY(),mc.player.getZ(),candidates);
  String scope=query.radius()==0?"玩家中心的全部已載入實體":"以你為中心、半徑"+query.radius()+"格內的已載入實體";
  if(found.isEmpty())return "在"+scope+"中沒有找到「"+Models.safe(query.query(),160)+"」。這不代表未載入區域或伺服器沒有牠；可移動後再問，或改用完整實體ID。";
  var nearest=found.get(0);var e=nearest.entity();String height=Math.abs(nearest.dy())<1?"高度與你相近":(nearest.dy()>0?"比你高":"比你低")+Math.round(Math.abs(nearest.dy()))+"格";
  return "最近的「"+e.name()+"」在你的"+NearbySearch.direction(nearest.dx(),nearest.dz())+"，直線距離約"+Math.round(nearest.distance())+"格，"+height+"。座標：X "+(int)Math.floor(e.x())+"，Y "+(int)Math.floor(e.y())+"，Z "+(int)Math.floor(e.z())+"。\n搜尋範圍："+scope+"；共找到"+found.size()+"個符合項目，不受視野或牆壁遮擋限制，仍受伺服器實體追蹤範圍限制。";
 }
 public static String fromAi(NearbyQuery query){
  var mc=Minecraft.getInstance();var level=mc.level;var player=mc.player;
  try{return mc.submit(()->{if(mc.level!=level||mc.player!=player)throw new IllegalStateException("世界已切換，請重新搜尋。");return find(query);}).get(10,TimeUnit.SECONDS);}catch(Exception e){throw new IllegalStateException("無法完成本機搜尋，請重新提問。",e);}
 }
 private NearbyEntities(){}
}
