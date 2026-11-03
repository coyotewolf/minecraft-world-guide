package io.github.coyotewolf.aoichecks;
import io.github.coyotewolf.aoi.model.*;import java.util.*;
public class RegistryChecks {
 static int count;static void check(boolean ok,String name){if(!ok)throw new AssertionError(name);count++;}
 public static void main(String[] args){
  var entries=List.of(new RegistryLookup.Entry("item","minecraft:chorus_fruit","歌萊果"),new RegistryLookup.Entry("entity","saintsdragons:nulljaw","虛顎龍"),new RegistryLookup.Entry("block","minecraft:stone","石頭"),new RegistryLookup.Entry("item","minecraft:stone","石頭"),new RegistryLookup.Entry("item","example:stone_tool","石頭工具"),new RegistryLookup.Entry("item","minecraft:iron_sword","鐵劍"));
  check(RegistryLookup.search(RegistryQuery.parse("歌萊果"),entries).get(0).id().equals("minecraft:chorus_fruit"),"Chinese exact name gives full namespace");
  check(RegistryLookup.search(RegistryQuery.parse("虛顎龍"),entries).get(0).kind().equals("entity"),"entity ID");
  check(RegistryLookup.search(RegistryQuery.parse("石頭"),entries).size()==2,"same name keeps item and block");
  check(RegistryLookup.search(RegistryQuery.parse("方塊 石頭"),entries).size()==1,"kind filter");
  check(RegistryLookup.search(RegistryQuery.parse("minecraft:stone"),entries).size()==2,"exact ID excludes prefix collisions");
  check(RegistryLookup.search(RegistryQuery.parse("iron sword"),entries).size()==1,"English ID path spaces");
  check(RegistryLookup.search(RegistryQuery.parse("nulljaw"),entries).size()==1,"ID fragment");
  check(RegistryLookup.search(RegistryQuery.parse("不存在"),entries).isEmpty(),"no fabricated ID");
  check(RegistryQuery.parse("").query().equals("@target"),"default target");check(RegistryQuery.parse("手持").query().equals("@hand"),"hand query");
  var action=Models.obj("version",new com.google.gson.JsonPrimitive(1),"type","registry_id","query","虛顎龍","kind","entity");check(RegistryQuery.action(action).kind().equals("entity"),"structured AI action");
  for(String key:List.of("version","kind","type","command")){var bad=action.deepCopy();if(key.equals("version"))bad.addProperty(key,2);else if(key.equals("kind"))bad.addProperty(key,"commands");else if(key.equals("type"))bad.addProperty(key,"RUN_COMMAND");else bad.addProperty(key,"/op player");try{RegistryQuery.action(bad);throw new AssertionError("unsafe accepted");}catch(IllegalArgumentException expected){check(true,"invalid operation rejected");}}
  try{new RegistryQuery("x".repeat(161),"any");throw new AssertionError();}catch(IllegalArgumentException expected){check(true,"bounded query");}
  System.out.println("Registry ID verification passed: "+count+" checks");
 }
}
