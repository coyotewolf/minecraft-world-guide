package io.github.coyotewolf.aoi.update;
import java.nio.file.*;
import java.net.*;
import java.time.*;
import java.security.*;
import java.util.*;
import java.util.zip.*;
import com.google.gson.*;

public class PrelaunchChecks {
 static int count;static KeyPair keys;static String publicKey;static Path oldJar,newJar;static String feed;
 static void check(boolean value,String name){if(!value)throw new AssertionError(name);count++;}
 static Path instance()throws Exception {
  Path root=Files.createTempDirectory("aoi-prelaunch-check-").resolve(".minecraft");Files.createDirectories(root.resolve("mods"));
  Files.copy(oldJar,root.resolve("mods/aoi-ai-assistant-1.20.1-0.1.11.jar"));return root;
 }
 static Path jar(String version)throws Exception {
  Path jar=Files.createTempFile("aoi-fixture-",".jar");try(var out=new ZipOutputStream(Files.newOutputStream(jar))){
   out.putNextEntry(new ZipEntry("META-INF/mods.toml"));out.write(("modId=\"aoi_assistant\"\nversion=\""+version+"\"").getBytes());out.closeEntry();
   out.putNextEntry(new ZipEntry("io/github/coyotewolf/aoi/AoiAssistantMod.class"));byte[] data=new byte[20000];new Random(4).nextBytes(data);out.write(data);out.closeEntry();
  }return jar;
 }
 static String signed(String version,Path jar)throws Exception {
  var payload=new JsonObject();payload.addProperty("protocol",1);payload.addProperty("modId","aoi_assistant");payload.addProperty("minecraft","1.20.1");payload.addProperty("loader","forge");payload.addProperty("channel","stable");payload.addProperty("version",version);
  payload.addProperty("publishedAt",Instant.now().minusSeconds(5).toString());payload.addProperty("expiresAt",Instant.now().plusSeconds(3600).toString());payload.addProperty("url","https://coyotewolf.github.io/minecraft-world-guide/downloads/aoi-ai-assistant-1.20.1-"+version+".jar");payload.addProperty("sha256",ReleaseManifest.hash(jar));payload.addProperty("bytes",Files.size(jar));
  byte[] bytes=payload.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);var signer=Signature.getInstance("Ed25519");signer.initSign(keys.getPrivate());signer.update(bytes);
  var envelope=new JsonObject();envelope.addProperty("payload",Base64.getEncoder().encodeToString(bytes));envelope.addProperty("signature",Base64.getEncoder().encodeToString(signer.sign()));return envelope.toString();
 }
 static byte[] fetch(URI uri,int limit)throws Exception {return uri.toString().endsWith(".json")?feed.getBytes(java.nio.charset.StandardCharsets.UTF_8):Files.readAllBytes(newJar);}
 static void rejected(Path root,PrelaunchUpdater.Fetch fetch)throws Exception {
  try{PrelaunchUpdater.run(root,fetch,publicKey);throw new AssertionError("not rejected");}catch(Exception expected){}
  check(Files.exists(root.resolve("mods/aoi-ai-assistant-1.20.1-0.1.11.jar")),"old retained");
 }
 public static void main(String[] args)throws Exception {
  keys=KeyPairGenerator.getInstance("Ed25519").generateKeyPair();publicKey=Base64.getEncoder().encodeToString(keys.getPublic().getEncoded());oldJar=jar("0.1.11");newJar=jar("0.1.12");feed=signed("0.1.12",newJar);
  Path root=instance();check(PrelaunchUpdater.run(root,PrelaunchChecks::fetch,publicKey).startsWith("updated"),"prelaunch applied");
  check(!Files.exists(root.resolve("mods/aoi-ai-assistant-1.20.1-0.1.11.jar")),"old absent before simulated game");
  check(ReleaseManifest.hash(root.resolve("mods/aoi-ai-assistant-1.20.1-0.1.12.jar")).equals(ReleaseManifest.hash(newJar)),"new loaded in same launch");
  try(var backups=Files.walk(root.resolve("aoi-assistant-backups"))){check(backups.anyMatch(p->p.getFileName().toString().endsWith("0.1.11.jar")),"backup");}
  check(PrelaunchUpdater.run(root,PrelaunchChecks::fetch,publicKey).contains("already current"),"idempotent");
  rejected(instance(),(u,l)->{throw new java.io.IOException("offline");});
  rejected(instance(),(u,l)->u.toString().endsWith(".json")?"{}".getBytes():Files.readAllBytes(newJar));
  rejected(instance(),(u,l)->u.toString().endsWith(".json")?feed.getBytes():new byte[20000]);
  root=instance();Files.createDirectories(root.resolve("config"));Files.writeString(root.resolve("config/aoi_assistant-client.toml"),"autoUpdate = false");check(PrelaunchUpdater.run(root,(u,l)->{throw new AssertionError("network when disabled");},publicKey).contains("disabled"),"preference");
  root=instance();Path state=root.resolve("config/aoi_assistant/update");Files.createDirectories(state);try(var lease=UpdateLease.acquire(state)){check(PrelaunchUpdater.run(root,(u,l)->{throw new AssertionError("locked fetch");},publicKey).contains("active"),"lock serialization");}
  root=instance();Files.copy(oldJar,root.resolve("mods/aoi-ai-assistant-other.jar"));check(PrelaunchUpdater.run(root,(u,l)->{throw new AssertionError("ambiguous fetch");},publicKey).contains("expected one"),"duplicate prevention");
  feed=signed("0.1.10",oldJar);check(PrelaunchUpdater.run(instance(),PrelaunchChecks::fetch,publicKey).contains("already current"),"no downgrade");
  root=instance();Path installed=root.resolve("mods/aoi-ai-assistant-1.20.1-0.1.11.jar"),saved=root.resolve("backup.jar"),part=root.resolve("part.jar"),dest=root.resolve("new.jar");Files.copy(newJar,part);
  try {PrelaunchUpdater.replace(installed,saved,part,dest,(from,to)->{if(from.equals(part))throw new java.io.IOException("simulated move failure");Files.move(from,to);});throw new AssertionError("move accepted");}catch(java.io.IOException expected){}
  check(Files.exists(installed)&&ReleaseManifest.hash(installed).equals(ReleaseManifest.hash(oldJar)),"rollback restores original");
  check(!Files.exists(dest),"rollback leaves no new mod");
  System.out.println("Prelaunch verification passed: "+count+" checks");
 }
}
