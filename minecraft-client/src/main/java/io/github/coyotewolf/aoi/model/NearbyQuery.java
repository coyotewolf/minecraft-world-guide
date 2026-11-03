package io.github.coyotewolf.aoi.model;
import com.google.gson.*;import com.mojang.brigadier.StringReader;import java.util.*;
public record NearbyQuery(String query,int radius) {
 public NearbyQuery {query=query.strip();if(query.isEmpty()||query.length()>160||radius<0)throw new IllegalArgumentException("請指定實體名稱或ID；半徑須為正整數。");}
 public static NearbyQuery parse(String input){
  String text=input.strip();if(text.isEmpty())throw new IllegalArgumentException("用法：/ai find 實體名稱 [半徑]。未指定半徑會搜尋全部已載入實體。");
  if(text.startsWith("\"")){try{var reader=new StringReader(text);String name=reader.readString();reader.skipWhitespace();boolean explicit=reader.canRead();int radius=explicit?reader.readInt():0;reader.skipWhitespace();if(reader.canRead()||radius<0||explicit&&radius==0)throw new IllegalArgumentException();return new NearbyQuery(name,radius);}catch(Exception e){throw new IllegalArgumentException("名稱含空格可加雙引號；半徑須為正整數。");}}
  var matcher=java.util.regex.Pattern.compile("^(.*)\\s+(-?\\d+)$").matcher(text);
  if(matcher.matches()){try{int radius=Integer.parseInt(matcher.group(2));if(radius<=0)throw new IllegalArgumentException();return new NearbyQuery(matcher.group(1),radius);}catch(Exception e){throw new IllegalArgumentException("半徑須為正整數；不指定就搜尋全部已載入實體。");}}
  return new NearbyQuery(text,0);
 }
 public static NearbyQuery action(JsonObject o){
  if(!o.keySet().equals(Set.of("version","type","query","radius"))||!"nearby_entities".equals(Models.text(o,"type",""))||!o.get("version").isJsonPrimitive()||!o.get("version").getAsJsonPrimitive().isNumber()||o.get("version").getAsDouble()!=1||!o.get("radius").isJsonPrimitive()||!o.get("radius").getAsJsonPrimitive().isNumber())throw new IllegalArgumentException("查找請求格式無效。");
  double radius=o.get("radius").getAsDouble();if(!Double.isFinite(radius)||radius<0||radius>Integer.MAX_VALUE||Math.rint(radius)!=radius)throw new IllegalArgumentException("搜尋半徑無效。");
  return new NearbyQuery(Models.text(o,"query",""),(int)radius);
 }
}
