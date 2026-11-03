package io.github.coyotewolf.aoi.client;
import com.google.gson.*;import io.github.coyotewolf.aoi.model.Models;import net.minecraft.client.Minecraft;import net.minecraft.locale.Language;import net.minecraft.network.chat.Component;import net.minecraft.client.gui.screens.Screen;import net.minecraftforge.registries.ForgeRegistries;import java.time.Instant;
/** Frozen, bounded gameplay fields only: no identity, credentials, chat, server address, seed or raw NBT. */
public final class PlayerContext {
 public static JsonObject location(){
  var mc=Minecraft.getInstance();var out=new JsonObject();if(mc.player==null||mc.level==null)return out;
  var pos=mc.player.blockPosition();out.addProperty("dimension",mc.level.dimension().location().toString());
  var point=new JsonObject();point.addProperty("x",pos.getX());point.addProperty("y",pos.getY());point.addProperty("z",pos.getZ());out.add("position",point);
  if(mc.level.hasChunkAt(pos))mc.level.getBiome(pos).unwrapKey().ifPresent(key->{var id=key.location();String translation="biome."+id.getNamespace()+"."+id.getPath().replace('/','.');String name=Language.getInstance().has(translation)?Component.translatable(translation).getString():id.toString();out.add("biome",Models.obj("id",id.toString(),"name",Models.safe(name,80)));});
  out.addProperty("structureStatus","未接入建築／地標邊界資料，不能只憑生態域或外觀確認特殊建築名稱");
  var objective=mc.level.getScoreboard().getDisplayObjective(1);if(objective!=null)out.addProperty("sidebarTitle",Models.safe(objective.getDisplayName().getString(),80));
  return out;
 }
 public static JsonObject capture(Screen previous){
  var mc=Minecraft.getInstance();if(!mc.isSameThread())throw new IllegalStateException("須在遊戲主執行緒擷取。");
  var out=new JsonObject();out.addProperty("version",1);out.addProperty("capturedAt",Instant.now().toString());var unavailable=new JsonArray();
  if(mc.player==null||mc.level==null){unavailable.add("未進入遊戲世界，沒有玩家與位置資料");out.add("unavailable",unavailable);return out;}
  var p=mc.player;var player=new JsonObject();player.addProperty("health",p.getHealth());player.addProperty("maxHealth",p.getMaxHealth());player.addProperty("absorption",p.getAbsorptionAmount());player.addProperty("food",p.getFoodData().getFoodLevel());player.addProperty("saturation",p.getFoodData().getSaturationLevel());player.addProperty("armor",p.getArmorValue());player.addProperty("air",Math.max(0,p.getAirSupply()));player.addProperty("maxAir",p.getMaxAirSupply());
  player.addProperty("experienceLevel",p.experienceLevel);player.addProperty("experienceProgress",p.experienceProgress);player.addProperty("totalExperience",p.totalExperience);int needed=p.getXpNeededForNextLevel();if(needed>0){player.addProperty("experienceNeeded",needed);player.addProperty("experienceRemaining",Math.max(0,Math.round((1-p.experienceProgress)*needed)));}
  player.addProperty("creative",p.isCreative());player.addProperty("spectator",p.isSpectator());player.addProperty("flying",p.getAbilities().flying);player.addProperty("onFire",p.isOnFire());player.addProperty("underWater",p.isUnderWater());player.addProperty("selectedSlot",p.getInventory().selected);
  var effects=new JsonArray();int omitted=0;for(var effect:p.getActiveEffects()){var id=ForgeRegistries.MOB_EFFECTS.getKey(effect.getEffect());if(id==null)continue;if(effects.size()>=64){omitted++;continue;}var row=Models.obj("id",id.toString(),"name",Models.safe(effect.getEffect().getDisplayName().getString(),64));row.addProperty("level",effect.getAmplifier()+1);row.addProperty("remainingTicks",effect.getDuration());effects.add(row);}player.add("effects",effects);player.addProperty("effectsOmitted",omitted);out.add("player",player);out.add("location",location());
  var observations=new JsonObject();observations.addProperty("worldTime",Math.floorMod(mc.level.getDayTime(),24000));observations.addProperty("raining",mc.level.isRaining());observations.addProperty("thundering",mc.level.isThundering());if(previous!=null)observations.addProperty("screenTitle",Models.safe(previous.getTitle().getString(),80));out.add("observations",observations);
  for(String value:new String[]{"未載入地形與實體","未開啟容器與其他玩家背包","未接入的模組技能、任務與特殊數值","歷史路線、基地與地圖標記","建築／地標邊界與結構名稱","畫面像素與建築外觀"})unavailable.add(value);out.add("unavailable",unavailable);return out;
 }
 private PlayerContext(){}
}
