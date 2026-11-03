package io.github.coyotewolf.aoi.client;
import io.github.coyotewolf.aoi.model.BiomeResult;import net.minecraft.client.Minecraft;import net.minecraft.locale.Language;import net.minecraft.network.chat.Component;import java.util.concurrent.TimeUnit;
public final class CurrentBiome {
 public static String find(){
  var mc=Minecraft.getInstance();if(!mc.isSameThread())throw new IllegalStateException("須在遊戲主執行緒查詢。");
  if(mc.player==null||mc.level==null)return "請進入世界後查詢目前生態域。";
  var pos=mc.player.blockPosition();if(!mc.level.hasChunkAt(pos))return "所在區域尚未載入，請稍候再查詢。";
  var key=mc.level.getBiome(pos).unwrapKey();if(key.isEmpty())return "遊戲沒有提供此位置生態域的註冊 ID，無法確認。";
  var id=key.get().location();String translation="biome."+id.getNamespace()+"."+id.getPath().replace('/','.');
  String name=Language.getInstance().has(translation)?Component.translatable(translation).getString():id.toString();
  String hint="";try{var location=PlayerContext.location();if(location.has("sidebarTitle"))hint="\n畫面側欄："+location.get("sidebarTitle").getAsString()+"（顯示文字，不代表已確認建築位置）。";}catch(RuntimeException|LinkageError ignored){}
  return new BiomeResult(id.toString(),name,mc.level.dimension().location().toString(),pos.getX(),pos.getY(),pos.getZ()).format()+hint+"\n特殊建築／地標目前缺少邊界資料，不能確認名稱。若你想辨識建築，請補充外觀、入口告示或地圖標記名稱。";
 }
 public static String fromAi(){var mc=Minecraft.getInstance();var level=mc.level;var player=mc.player;try{return mc.submit(()->{if(mc.level!=level||mc.player!=player)throw new IllegalStateException("世界已切換");return find();}).get(10,TimeUnit.SECONDS);}catch(Exception e){throw new IllegalStateException("生態域查詢未完成，請重新提問。",e);}}
 private CurrentBiome(){}
}
