package io.github.coyotewolf.aoi.model;

import com.google.gson.*;
import java.time.Instant;
import java.util.*;

public final class Models {
 public record Conversation(String id,String title,String updatedAt) {}
 public record Message(String id,String conversationId,String role,String text,JsonArray facts,String createdAt,boolean synced) {
  public Message syncedCopy(){return new Message(id,conversationId,role,text,facts.deepCopy(),createdAt,true);}
  public JsonObject row(String user){return obj("id",id,"conversation_id",conversationId,"user_id",user,"role",role,"text",text,"facts",facts,"created_at",createdAt);}
 }
 public record Answer(String text,JsonArray facts) {}
 public record Page<T>(List<T> rows,boolean more) {}
 // Reserved extension only. No automatic game/coordinate/server data collection.
 public record GameContext(String kind,String registryId,String displayName) {}
 public static String id(){return UUID.randomUUID().toString();}
 public static String uuid(String value){if(value==null||!value.matches("(?i)[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"))throw new IllegalArgumentException("資料代碼無效。");return value;}
 public static String text(JsonObject o,String key,String fallback){var v=o.get(key);return v!=null&&v.isJsonPrimitive()&&v.getAsJsonPrimitive().isString()?v.getAsString():fallback;}
 public static String safe(String value,int max){
  if(value==null)return "";
  String s=value.replaceAll("[\\p{Cc}&&[^\\n\\t]]","").replace('§',' ');
  if(s.length()<=max)return s;
  int end=max;if(end>0&&Character.isHighSurrogate(s.charAt(end-1)))end--;
  return s.substring(0,end)+"…";
 }
 public static JsonArray facts(JsonObject o){var f=o.get("facts");return f!=null&&f.isJsonArray()?f.getAsJsonArray().deepCopy():new JsonArray();}
 public static Answer answer(JsonObject o){
  String s=text(o,"answer",null);
  if(s==null||s.isBlank()||s.length()>8000)throw new IllegalArgumentException("伺服器回答格式異常，請重試。");
  return new Answer(safe(s,8000),facts(o));
 }
 public static Message message(JsonObject o){
  String role=text(o,"role","");if(!role.equals("user")&&!role.equals("assistant"))throw new IllegalArgumentException("訊息角色無效。");
  String at=text(o,"created_at","");Instant.parse(at);
  return new Message(uuid(text(o,"id",null)),uuid(text(o,"conversation_id",null)),role,safe(text(o,"text",""),8000),facts(o),at,true);
 }
 public static JsonObject obj(Object... pairs){
  var o=new JsonObject();for(int i=0;i<pairs.length;i+=2){Object v=pairs[i+1];if(v instanceof JsonElement j)o.add((String)pairs[i],j.deepCopy());else if(v instanceof Boolean b)o.addProperty((String)pairs[i],b);else o.addProperty((String)pairs[i],String.valueOf(v));}return o;
 }
 public static final Comparator<Message> MESSAGE_ORDER=Comparator.comparing((Message m)->Instant.parse(m.createdAt())).thenComparing(Message::id);
 private Models(){}
}
