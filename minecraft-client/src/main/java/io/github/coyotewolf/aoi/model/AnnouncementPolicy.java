package io.github.coyotewolf.aoi.model;

import com.google.gson.*;
import java.time.Instant;
import java.util.*;

/** Plain text only, bounded feed and local deduplication. No executable components. */
public final class AnnouncementPolicy {
 public record Notice(String id,String title,String body,Instant expires){}
 private final LinkedHashSet<String> seen=new LinkedHashSet<>();
 private int failures;
 public static List<Notice> parse(JsonElement json){
  var root=json.getAsJsonObject();if(root.get("version").getAsInt()!=1)throw new IllegalArgumentException("version");
  var rows=root.getAsJsonArray("announcements");if(rows.size()>20)throw new IllegalArgumentException("count");
  var result=new ArrayList<Notice>();var ids=new HashSet<String>();
  for(var row:rows){var n=row.getAsJsonObject();String id=n.get("id").getAsString();if(!UUID.fromString(id).toString().equals(id)||!ids.add(id))throw new IllegalArgumentException("id");
   String title=text(n.get("title"),80,false),body=text(n.get("body"),500,true);var expiry=Instant.parse(n.get("expires_at").getAsString());
   result.add(new Notice(id,title,body,expiry));
  }return List.copyOf(result);
 }
 private static String text(JsonElement value,int max,boolean multiline){String s=value.getAsString();if(s.isBlank()||s.codePointCount(0,s.length())>max||s.codePoints().anyMatch(c->Character.isISOControl(c)&&!(multiline&&c==10)||c==0xA7||c==0x202E||c>=0x2066&&c<=0x2069))throw new IllegalArgumentException("text");return s;}
 public List<Notice> unread(List<Notice> notices,Instant now){return notices.stream().filter(n->n.expires().isAfter(now)&&!seen.contains(n.id())).toList();}
 public void acknowledge(String id){seen.add(id);while(seen.size()>512)seen.remove(seen.iterator().next());}
 public String snapshot(){return String.join("\n",seen);}
 public void restore(String stored){if(stored.length()>20000)throw new IllegalArgumentException("state");for(String line:stored.split("\n"))try{if(UUID.fromString(line).toString().equals(line))acknowledge(line);}catch(IllegalArgumentException ignored){}}
 public long delayMillis(boolean success,int jitter){if(success)failures=0;else failures=Math.min(4,failures+1);return Math.min(900000L,60000L*(1L<<failures))+Math.floorMod(jitter,15001);}
}
