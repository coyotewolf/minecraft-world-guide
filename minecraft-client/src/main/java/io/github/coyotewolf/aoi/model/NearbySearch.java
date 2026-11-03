package io.github.coyotewolf.aoi.model;
import java.util.*;
public final class NearbySearch {
 public record Candidate(String id,String name,String extra,double x,double y,double z) {}
 public record Found(Candidate entity,double distance,double dx,double dy,double dz) {}
 public static List<Found> search(NearbyQuery query,double x,double y,double z,Iterable<Candidate> entities){
  var terms=Arrays.stream(query.query().toLowerCase(Locale.ROOT).split("[,，、]")).map(String::strip).filter(t->!t.isEmpty()).toList();if(terms.isEmpty())throw new IllegalArgumentException("請指定實體。");
  var found=new ArrayList<Found>();for(var entity:entities){
   String hay=(entity.id()+" "+entity.name()+" "+entity.extra()).toLowerCase(Locale.ROOT);
   if(!terms.stream().anyMatch(t->t.contains(":")?entity.id().equals(t)||Arrays.asList(entity.extra().split("\\s+")).contains(t):hay.contains(t)))continue;
   double dx=entity.x()-x,dy=entity.y()-y,dz=entity.z()-z,distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
   if(Double.isFinite(distance)&&(query.radius()==0||distance<=query.radius()))found.add(new Found(entity,distance,dx,dy,dz));
  }
  found.sort(Comparator.comparingDouble(Found::distance).thenComparing(f->f.entity().id()).thenComparingDouble(f->f.entity().x()).thenComparingDouble(f->f.entity().z()));return List.copyOf(found);
 }
 public static String direction(double dx,double dz){if(Math.hypot(dx,dz)<1)return "幾乎就在你的位置";String[] names={"北","東北","東","東南","南","西南","西","西北"};int index=Math.floorMod((int)Math.round(Math.atan2(dx,-dz)/(Math.PI/4)),8);return names[index]+"方";}
 private NearbySearch(){}
}
