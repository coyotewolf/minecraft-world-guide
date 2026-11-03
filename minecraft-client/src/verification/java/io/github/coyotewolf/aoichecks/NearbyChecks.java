package io.github.coyotewolf.aoichecks;
import io.github.coyotewolf.aoi.model.*;import java.util.*;
public final class NearbyChecks {
 private static int checks;private static void check(boolean ok,String text){if(!ok)throw new AssertionError(text);checks++;}
 public static void main(String[] args){
  var all=NearbyQuery.parse("虛顎龍");check(all.radius()==0,"unspecified radius searches all loaded entities");check(NearbyQuery.parse("saintsdragons:nulljaw 200").radius()==200,"specified radius");check(NearbyQuery.parse("\"my dragon 2\" 50").query().equals("my dragon 2"),"quoted name");
  for(String bad:List.of("","虛顎龍 0","虛顎龍 -1","虛顎龍 9999999999999999"))try{NearbyQuery.parse(bad);throw new AssertionError("bad accepted");}catch(IllegalArgumentException expected){check(true,"bad radius rejected");}
  var entities=List.of(new NearbySearch.Candidate("saintsdragons:nulljaw","虛顎龍","",100,64,0),new NearbySearch.Candidate("saintsdragons:nulljaw","虛顎龍","",0,65,-3),new NearbySearch.Candidate("minecraft:piglin","豬布林","",0,64,1));
  var found=NearbySearch.search(all,0,64,0,entities);check(found.size()==2&&found.get(0).entity().z()==-3,"nearest uses player center in 3D, including behind-wall entities without a visibility condition");
  check(NearbySearch.search(new NearbyQuery("虛顎龍",3),0,64,0,entities).isEmpty(),"vertical distance counts for spherical radius");check(NearbySearch.search(new NearbyQuery("saintsdragons:nulljaw",4),0,64,0,entities).size()==1,"explicit radius applied");
  check(NearbySearch.search(new NearbyQuery("minecraft:pig",0),0,64,0,entities).isEmpty(),"entity IDs never prefix-match another species");
  check(NearbySearch.search(all,100,64,0,entities).get(0).distance()==0,"search center follows player movement");
  check(NearbySearch.direction(1,0).equals("東方")&&NearbySearch.direction(0,-2).equals("北方")&&NearbySearch.direction(-2,2).equals("西南方"),"world cardinal directions");
  var action=Models.obj("version",new com.google.gson.JsonPrimitive(1),"type","nearby_entities","query","虛顎龍","radius",new com.google.gson.JsonPrimitive(0));check(NearbyQuery.action(action).radius()==0,"AI all-loaded action");
  for(String key:List.of("type","radius")){var bad=action.deepCopy();if(key.equals("type"))bad.addProperty(key,"RUN_COMMAND");else bad.addProperty(key,1.5);try{NearbyQuery.action(bad);throw new AssertionError();}catch(IllegalArgumentException expected){check(true,"unsafe AI action rejected");}}
  var injection=action.deepCopy();injection.addProperty("command","/op player");try{NearbyQuery.action(injection);throw new AssertionError();}catch(IllegalArgumentException expected){check(true,"extra commands rejected");}
  System.out.println("Nearby entity verification passed: "+checks+" checks");
 }
}
