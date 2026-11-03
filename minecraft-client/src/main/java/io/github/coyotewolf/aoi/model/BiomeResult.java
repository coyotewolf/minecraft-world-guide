package io.github.coyotewolf.aoi.model;
import com.google.gson.*;import java.util.*;
public record BiomeResult(String id,String name,String dimension,int x,int y,int z) {
 public String format(){return "目前生態域："+(name==null||name.isBlank()?id:name)+"\n完整 ID："+id+"\n維度："+dimension+"；位置：X "+x+"，Y "+y+"，Z "+z+"。\n以玩家所在位置（含高度）讀取；地下與地表可能是不同生態域。";}
 public static void validateAction(JsonObject o){
  if(!o.keySet().equals(Set.of("version","type"))||!o.get("version").isJsonPrimitive()||!o.getAsJsonPrimitive("version").isNumber()||o.get("version").getAsDouble()!=1||!o.get("type").isJsonPrimitive()||!o.getAsJsonPrimitive("type").isString()||!o.get("type").getAsString().equals("current_biome"))throw new IllegalArgumentException("生態域查詢格式無效。");
 }
}
