package io.github.coyotewolf.aoichecks;
import io.github.coyotewolf.aoi.model.*;import java.util.*;
public class BiomeChecks {
 static int count;static void check(boolean ok,String name){if(!ok)throw new AssertionError(name);count++;}
 public static void main(String[] args){
  var result=new BiomeResult("minecraft:lush_caves","蒼鬱洞窟","minecraft:overworld",-120,-32,88).format();check(result.contains("蒼鬱洞窟")&&result.contains("minecraft:lush_caves"),"name and full biome ID");check(result.contains("Y -32")&&result.contains("X -120")&&result.contains("minecraft:overworld"),"dimension and vertical player position");check(new BiomeResult("mod:unknown",null,"mod:dimension",0,50,0).format().contains("mod:unknown"),"untranslated biome retains actual ID");
  var action=Models.obj("version",new com.google.gson.JsonPrimitive(1),"type","current_biome");BiomeResult.validateAction(action);check(true,"valid local action");
  for(String key:List.of("version","type","command","coordinates")){var bad=action.deepCopy();if(key.equals("version"))bad.addProperty(key,"1");else if(key.equals("type"))bad.addProperty(key,"RUN_COMMAND");else bad.addProperty(key,"/tp player");try{BiomeResult.validateAction(bad);throw new AssertionError("unsafe accepted");}catch(IllegalArgumentException expected){check(true,"reject unsafe action");}}
  System.out.println("Biome verification passed: "+count+" checks");
 }
}
