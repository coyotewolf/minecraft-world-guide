package io.github.coyotewolf.aoichecks;

import io.github.coyotewolf.aoi.net.Transport;
import io.github.coyotewolf.aoi.model.Models;
import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** Unauthenticated live checks only: never creates chats or consumes model quota. */
public final class LiveChecks {
 public static void main(String[] args)throws Exception{
  var http=Transport.https();String base="https://aoi-free-guide.aoi-free-cloud-guide.workers.dev";
  String origin="https://coyotewolf.github.io",cid="00000000-0000-4000-8000-000000000001";
  var bad=Map.of("Authorization","Bearer deliberately-invalid-token");
  var results=new com.google.gson.JsonArray();
  record Case(String label,String path,String method,Map<String,String> headers,com.google.gson.JsonElement body,int expected){}
  var cases=List.of(
   new Case("website health","/health","GET",Map.of("Origin",origin),null,200),
   new Case("native no token","/status","GET",Map.of(),null,401),
   new Case("native bad token","/status","GET",bad,null,401),
   new Case("native ask bad token","/ask","POST",bad,Models.obj("question","authorization check","conversationId",cid,"requestId",cid),401),
   new Case("native forget bad token","/forget","POST",bad,Models.obj("conversationId",cid),401),
   new Case("native admin blocked","/admin/quotas","GET",bad,null,403),
   new Case("native health blocked","/health","GET",bad,null,403),
   new Case("browser status requires auth","/status","GET",Map.of("Origin",origin),null,401),
   new Case("browser preflight","/ask","OPTIONS",Map.of("Origin",origin),null,204),
   new Case("untrusted browser blocked","/status","GET",Map.of("Origin","https://evil.example"),null,403),
   new Case("null origin blocked","/status","GET",Map.of("Origin","null"),null,403),
   new Case("native preflight blocked","/ask","OPTIONS",bad,null,403),
   new Case("size limit","/ask","POST",bad,Models.obj("question","x".repeat(140000)),413),
   new Case("invalid UUID","/ask","POST",bad,Models.obj("question","test","conversationId","bad"),400)
  );
  for(var test:cases){
   var r=http.request(test.method(),URI.create(base+test.path()),test.headers(),test.body(),20);
   if(r.status()!=test.expected())throw new AssertionError(test.label()+": expected "+test.expected()+", got "+r.status());
   if(test.label().equals("website health")&&(!r.body().getAsJsonObject().get("ready").getAsBoolean()||r.body().getAsJsonObject().get("gameContextVersion").getAsInt()!=1))throw new AssertionError("scene service not ready");
   results.add(Models.obj("case",test.label(),"status",String.valueOf(r.status()),"passed",true));System.out.println("LIVE PASS "+test.label()+" "+r.status());
  }
  Files.writeString(Path.of("live-java-checks.json"),Models.obj("passed",true,"cases",results).toString());
  System.out.println("Real Java HTTPS verification passed: "+cases.size()+" cases, no credentials or AI quota used.");
 }
}
