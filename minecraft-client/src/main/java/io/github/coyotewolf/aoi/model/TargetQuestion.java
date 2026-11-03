package io.github.coyotewolf.aoi.model;

/** A fixed description, stored with the question so retries never retarget it. */
public record TargetQuestion(String kind,String name,String id) {
 public String label(){return kind+"："+name+"（"+id+"）";}
 public String attach(String question){
  String text="[準心目標] "+label()+"\n[玩家問題] "+question.trim();
  if(text.length()>600)throw new IllegalArgumentException("附上目標後超過 600 字，請縮短問題（目標資訊佔 "+(text.length()-question.trim().length())+" 字）。");
  return text;
 }
}
