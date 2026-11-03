package io.github.coyotewolf.aoichecks;
import com.google.gson.*;
import io.github.coyotewolf.aoi.update.ReleaseManifest;
import java.security.*;
import java.time.Instant;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
public final class UpdateChecks {
 private static int checks;private interface Action {void run()throws Exception;}
 private static void check(boolean b,String label){if(!b)throw new AssertionError(label);checks++;}
 private static void fails(Action a)throws Exception{try{a.run();throw new AssertionError("invalid release accepted");}catch(SecurityException|IllegalArgumentException e){checks++;}}
 private static String sign(JsonObject payload,PrivateKey key)throws Exception{byte[] bytes=payload.toString().getBytes(StandardCharsets.UTF_8);var sig=Signature.getInstance("Ed25519");sig.initSign(key);sig.update(bytes);var root=new JsonObject();root.addProperty("payload",Base64.getEncoder().encodeToString(bytes));root.addProperty("signature",Base64.getEncoder().encodeToString(sig.sign()));return root.toString();}
 public static void main(String[] args)throws Exception{
  var pair=KeyPairGenerator.getInstance("Ed25519").generateKeyPair();String pub=Base64.getEncoder().encodeToString(pair.getPublic().getEncoded());var now=Instant.parse("2026-10-11T00:00:00Z");
  var payload=JsonParser.parseString("{\"protocol\":1,\"modId\":\"aoi_assistant\",\"minecraft\":\"1.20.1\",\"loader\":\"forge\",\"channel\":\"stable\",\"version\":\"0.1.7\",\"url\":\"https://coyotewolf.github.io/minecraft-world-guide/downloads/aoi-ai-assistant-1.20.1-0.1.7.jar\",\"sha256\":\""+"a".repeat(64)+"\",\"bytes\":123456,\"publishedAt\":\"2026-10-11T00:00:00Z\",\"expiresAt\":\"2027-01-01T00:00:00Z\"}").getAsJsonObject();
  String signed=sign(payload,pair.getPrivate());var release=ReleaseManifest.verify(signed,"0.1.6",now,pub);check(release.version().equals("0.1.7"),"valid signed release");check(ReleaseManifest.compare("0.1.10","0.1.9")>0,"numeric version");check(ReleaseManifest.compare("0.1.7","0.1.7")==0,"same version");check(ReleaseManifest.compare("0.1.6","0.1.7")<0,"no downgrade selection");
  fails(()->ReleaseManifest.verify(signed,"0.1.6",now,Base64.getEncoder().encodeToString(KeyPairGenerator.getInstance("Ed25519").generateKeyPair().getPublic().getEncoded())));
  var tampered=JsonParser.parseString(signed).getAsJsonObject();tampered.addProperty("payload",Base64.getEncoder().encodeToString(payload.deepCopy().toString().replace("0.1.7","0.1.8").getBytes(StandardCharsets.UTF_8)));fails(()->ReleaseManifest.verify(tampered.toString(),"0.1.6",now,pub));
  for(String[] change:new String[][]{{"url","https://evil.test/a.jar"},{"url","https://coyotewolf.github.io/minecraft-world-guide/downloads/../a.jar"},{"minecraft","1.21"},{"loader","fabric"},{"channel","beta"},{"version","01.2.3"},{"expiresAt","2026-10-10T00:00:00Z"},{"publishedAt","2026-10-13T00:00:00Z"},{"sha256","bad"}}){var p=payload.deepCopy();p.addProperty(change[0],change[1]);fails(()->ReleaseManifest.verify(sign(p,pair.getPrivate()),"0.1.6",now,pub));}
  var big=payload.deepCopy();big.addProperty("bytes",16777217);fails(()->ReleaseManifest.verify(sign(big,pair.getPrivate()),"0.1.6",now,pub));
  fails(()->ReleaseManifest.compare("0.1.7-beta","0.1.6"));
  Path fixture=Files.createTempFile("aoi-update-check-",".jar");try{
   try(var zip=new ZipOutputStream(Files.newOutputStream(fixture))){zip.putNextEntry(new ZipEntry("META-INF/mods.toml"));zip.write("[[mods]]\nmodId=\"aoi_assistant\"\nversion=\"0.1.7\"\n".getBytes(StandardCharsets.UTF_8));zip.closeEntry();zip.putNextEntry(new ZipEntry("io/github/coyotewolf/aoi/AoiAssistantMod.class"));zip.write(new byte[]{1,2});zip.closeEntry();}
   var checked=new ReleaseManifest("0.1.7",release.url(),ReleaseManifest.hash(fixture),Files.size(fixture));checked.verifyJar(fixture);checks++;
   fails(()->new ReleaseManifest("0.1.8",release.url(),checked.sha256(),checked.bytes()).verifyJar(fixture));
   fails(()->new ReleaseManifest("0.1.7",release.url(),"f".repeat(64),checked.bytes()).verifyJar(fixture));
  }finally{Files.deleteIfExists(fixture);}
  Path leaseDir=Files.createTempDirectory("aoi-lease-");try{
   try(var first=io.github.coyotewolf.aoi.update.UpdateLease.acquire(leaseDir)){
    check(first!=null,"update lease acquired");check(io.github.coyotewolf.aoi.update.UpdateLease.acquire(leaseDir)==null,"another update cannot overwrite locked staging");
   }
   try(var next=io.github.coyotewolf.aoi.update.UpdateLease.acquire(leaseDir)){check(next!=null,"lease released after staging");next.close();}
  }finally{Files.deleteIfExists(leaseDir.resolve("apply.lock"));Files.deleteIfExists(leaseDir);}
  System.out.println("Update verification passed: "+checks+" checks");
 }
}
