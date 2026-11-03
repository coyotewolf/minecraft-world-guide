package io.github.coyotewolf.aoichecks;
import com.google.gson.*;
import io.github.coyotewolf.aoi.model.AnnouncementPolicy;
import java.time.Instant;
import java.util.UUID;
public final class AnnouncementChecks {
 private static int count;
 private static void check(boolean b,String name){if(!b)throw new AssertionError(name);count++;}
 private static void bad(JsonObject root){try{AnnouncementPolicy.parse(root);throw new AssertionError("accepted invalid feed");}catch(IllegalArgumentException|IllegalStateException e){count++;}}
 public static void main(String[] args){
  var policy=new AnnouncementPolicy();var root=JsonParser.parseString("{\"version\":1,\"announcements\":[{\"id\":\"00000000-0000-4000-8000-000000000001\",\"title\":\"維護\",\"body\":\"今晚維護\",\"expires_at\":\"2026-10-12T00:00:00Z\"}]}").getAsJsonObject();
  var rows=AnnouncementPolicy.parse(root);var now=Instant.parse("2026-10-11T00:00:00Z");check(policy.unread(rows,now).size()==1,"unread");
  policy.acknowledge(rows.get(0).id());check(policy.unread(rows,now).isEmpty(),"dedup");var restored=new AnnouncementPolicy();restored.restore(policy.snapshot());check(restored.unread(rows,now).isEmpty(),"restart persistence");
  check(new AnnouncementPolicy().unread(rows,Instant.parse("2026-10-12T00:00:00Z")).isEmpty(),"expire at boundary");
  check(policy.delayMillis(true,0)==60000,"normal interval");check(policy.delayMillis(true,15000)==75000,"jitter");
  for(long expected:new long[]{120000,240000,480000,900000,900000})check(policy.delayMillis(false,0)==expected,"bounded backoff");check(policy.delayMillis(true,0)==60000,"recover");
  var multiline=root.deepCopy();multiline.getAsJsonArray("announcements").get(0).getAsJsonObject().addProperty("body","第一行\n第二行");check(AnnouncementPolicy.parse(multiline).get(0).body().contains("\n"),"multiline literal");
  for(String invalid:new String[]{"§khidden","line\rnext","\u202Espoof","","x".repeat(501)}){var r=root.deepCopy();r.getAsJsonArray("announcements").get(0).getAsJsonObject().addProperty("body",invalid);bad(r);}
  var duplicate=root.deepCopy();duplicate.getAsJsonArray("announcements").add(duplicate.getAsJsonArray("announcements").get(0).deepCopy());bad(duplicate);
  var version=root.deepCopy();version.addProperty("version",2);bad(version);
  var many=root.deepCopy();for(int i=0;i<20;i++)many.getAsJsonArray("announcements").add(root.getAsJsonArray("announcements").get(0));bad(many);
  for(int i=0;i<600;i++)policy.acknowledge(UUID.randomUUID().toString());check(policy.snapshot().split("\n").length==512,"bounded disk state");
  restored.restore("invalid\n");check(restored.unread(rows,now).isEmpty(),"ignore malformed saved lines");
  System.out.println("Announcement verification passed: "+count+" checks");
 }
}
