package io.github.coyotewolf.aoichecks;
import com.google.gson.*;import io.github.coyotewolf.aoi.model.Models;import io.github.coyotewolf.aoi.net.*;import io.github.coyotewolf.aoi.security.SessionManager;import java.util.*;import java.time.Instant;
public class PlayerContextChecks {
 static int checks;static void check(boolean yes,String name){if(!yes)throw new AssertionError(name);checks++;}
 static class Wire implements Transport {
  final List<JsonObject> posts=new ArrayList<>();boolean handled,unsafe;JsonObject original;
  public Reply request(String method,java.net.URI uri,Map<String,String> headers,JsonElement body,int timeout){
   check("Bearer test-access".equals(headers.get("Authorization")),"each stage uses same authenticated account");
   if(uri.getPath().equals("/status"))return new Reply(200,Models.obj("gameContextVersion",new JsonPrimitive(1),"playerContextVersion",new JsonPrimitive(1)));
   if(!uri.getPath().equals("/ask"))throw new AssertionError("unexpected endpoint");var input=body.getAsJsonObject();posts.add(input.deepCopy());
   check(!input.getAsJsonObject("gameContext").has("playerContext"),"extra snapshot is stripped from original scene");
   if(!input.has("contextToken")){check(!input.has("playerContext"),"first pass never transmits extra player data");if(original!=null)original.getAsJsonObject("playerContext").getAsJsonObject("player").addProperty("health",1);
    if(handled)return new Reply(200,Models.obj("answer","原流程已回答","facts",new JsonArray()));
    var action=Models.obj("version",new JsonPrimitive(1),"type","player_context","token","33333333-3333-4333-8333-333333333333");if(unsafe)action.addProperty("command","/op player");return new Reply(200,Models.obj("clientAction",action));
   }
   check(input.getAsJsonObject("playerContext").getAsJsonObject("player").get("health").getAsInt()==12,"continuation reuses frozen data despite input mutation");check(input.get("requestId").equals(posts.get(0).get("requestId")),"continuation keeps original message ID");return new Reply(200,Models.obj("answer","你有12點生命值","facts",new JsonArray()));
  }
 }
 static AssistantApi api(Wire wire){var sessions=new SessionManager();sessions.install(Models.obj("access_token","test-access","refresh_token","test-refresh","expires_at",new JsonPrimitive(Instant.now().getEpochSecond()+3600),"user",Models.obj("id","00000000-0000-4000-8000-000000000001")),sessions.generation());return new AssistantApi("https://ai.example","https://db.example","public",sessions,wire);}
 static JsonObject scene(){return Models.obj("version",new JsonPrimitive(1),"playerContext",Models.obj("version",new JsonPrimitive(1),"player",Models.obj("health",new JsonPrimitive(12))));}
 public static void main(String[] args){
  var wire=new Wire();wire.original=scene();check(api(wire).ask("現在剩多少血","11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222",wire.original).text().contains("12點生命值"),"conditional second pass returns actual snapshot answer");check(wire.posts.size()==2,"exactly one conditional continuation");
  wire=new Wire();wire.handled=true;api(wire).ask("已知攻略","11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222",scene());check(wire.posts.size()==1,"handled legacy answer never triggers a second pass");
  wire=new Wire();wire.unsafe=true;try{api(wire).ask("q","11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222",scene());throw new AssertionError("unsafe accepted");}catch(ApiException expected){check(expected.status==503&&wire.posts.size()==1,"extra operation in continuation is rejected");}
  System.out.println("Player context verification passed: "+checks+" checks");
 }
}
