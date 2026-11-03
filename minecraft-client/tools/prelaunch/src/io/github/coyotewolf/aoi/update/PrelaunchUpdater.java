package io.github.coyotewolf.aoi.update;

import java.nio.file.*;
import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.nio.ByteBuffer;
import java.io.*;

/** Separate JVM: finishes before Forge opens any mod JAR. No credentials or AI calls. */
public final class PrelaunchUpdater {
 public static void main(String[] args) {
  if(args.length!=1) {System.err.println("AOI: expected Minecraft directory");System.exit(1);}
  try {System.out.println("AOI: "+run(Path.of(args[0]),PrelaunchUpdater::fetch,ReleaseManifest.PUBLIC_KEY));}
  catch(RestoreFailure e) {System.err.println("AOI: restore old JAR from "+e.getMessage());System.exit(2);}
  catch(Exception e) {System.err.println("AOI: update skipped ("+e.getClass().getSimpleName()+"); existing version retained.");}
 }
 interface Fetch {byte[] get(URI uri,int limit) throws Exception;}
 static String run(Path root,Fetch fetch,String key)throws Exception {
  root=root.toRealPath();
  Path config=root.resolve("config/aoi_assistant-client.toml");
  // Respect the existing Forge client preference, including section indentation.
  if(Files.exists(config)&&Files.readString(config).matches("(?s).*\\bautoUpdate\\s*=\\s*false\\b.*"))return "automatic updates disabled";
  if(running(root))return "game already running; update skipped";
  Path mods=root.resolve("mods").toRealPath(),state=root.resolve("config/aoi_assistant/update");Files.createDirectories(state);
  if(!mods.equals(root.resolve("mods"))||!state.toRealPath().equals(state))throw new SecurityException("redirected directory");
  try(var lease=UpdateLease.acquire(state)) {
   if(lease==null)return "another updater is active; update skipped";
   List<Path> installed;
   try(var files=Files.list(mods)){installed=files.filter(p->p.getFileName().toString().startsWith("aoi-ai-assistant-")&&p.toString().endsWith(".jar")).toList();}
   if(installed.size()!=1)return "expected one AOI mod; update skipped";
   Path old=installed.get(0);if(Files.isSymbolicLink(old))throw new SecurityException("symlink");
   var match=java.util.regex.Pattern.compile("aoi-ai-assistant-1\\.20\\.1-([0-9]+\\.[0-9]+\\.[0-9]+)\\.jar").matcher(old.getFileName().toString());
   if(!match.matches())return "custom filename; update skipped";
   String version=match.group(1),oldHash=ReleaseManifest.hash(old);
   new ReleaseManifest(version,URI.create(ReleaseManifest.FEED),oldHash,Files.size(old)).verifyJar(old);
   var release=ReleaseManifest.verify(new String(fetch.get(URI.create(ReleaseManifest.FEED),16384),java.nio.charset.StandardCharsets.UTF_8),version,Instant.now(),key);
   if(ReleaseManifest.compare(release.version(),version)<=0)return "already current: "+version;
   Path part=Files.createTempFile(state,"prelaunch-",".jar");
   try {
    Files.write(part,fetch.get(release.url(),(int)release.bytes()));release.verifyJar(part);
    if(running(root)||!ReleaseManifest.hash(old).equals(oldHash))throw new SecurityException("instance changed");
    if(Files.exists(config)&&Files.readString(config).matches("(?s).*\\bautoUpdate\\s*=\\s*false\\b.*"))return "automatic updates disabled";
    Path dest=mods.resolve("aoi-ai-assistant-1.20.1-"+release.version()+".jar");
    if(Files.exists(dest))throw new SecurityException("destination exists");
    Path backup=root.resolve("aoi-assistant-backups/prelaunch-"+release.version()+"-"+UUID.randomUUID());Files.createDirectories(backup);
    if(!backup.toRealPath().equals(backup))throw new SecurityException("redirected backup");
    Path saved=backup.resolve(old.getFileName());replace(old,saved,part,dest,(from,to)->Files.move(from,to));
    try {Files.writeString(state.resolve("prelaunch-result.json"),"{\"success\":true,\"version\":\""+release.version()+"\",\"appliedBeforeGame\":true}");}catch(IOException ignored){}
    return "updated to "+release.version()+"; this launch will use the new version";
   }finally{Files.deleteIfExists(part);}
  }
 }
 interface Move {void run(Path from,Path to)throws IOException;}
 static class RestoreFailure extends IOException {RestoreFailure(Path path,Throwable cause){super(path.toString(),cause);}}
 static void replace(Path old,Path saved,Path part,Path dest,Move move)throws IOException {
  move.run(old,saved);
  try{move.run(part,dest);}catch(IOException failure){
   try{move.run(saved,old);}catch(IOException rollback){failure.addSuppressed(rollback);throw new RestoreFailure(saved,failure);}
   throw failure;
  }
 }
 static boolean running(Path root) {
  String scope=root.getParent().toString().replace('\\','/').toLowerCase(Locale.ROOT);
  return ProcessHandle.allProcesses().filter(p->p.pid()!=ProcessHandle.current().pid()).anyMatch(p->{
   var info=p.info();String command=info.command().orElse("").toLowerCase(Locale.ROOT);
   if(!(command.endsWith("java.exe")||command.endsWith("javaw.exe")||command.endsWith("/java")))return false;
   // Arguments are inspected locally only; never logged (may contain Minecraft login tokens).
   return Arrays.stream(info.arguments().orElse(new String[0])).anyMatch(a->a.replace('\\','/').toLowerCase(Locale.ROOT).contains(scope));
  });
 }
 static byte[] fetch(URI uri,int limit)throws Exception {
  var client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
  var future=client.sendAsync(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(25)).GET().build(), info->new LimitedBody(limit));
  try {var response=future.get(27,TimeUnit.SECONDS);if(response.statusCode()!=200)throw new IOException("HTTP status");return response.body();}
  catch(Exception e){future.cancel(true);throw e;}
 }
 static final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {
  final int limit;final CompletableFuture<byte[]> result=new CompletableFuture<>();final ByteArrayOutputStream out=new ByteArrayOutputStream();Flow.Subscription subscription;
  LimitedBody(int limit){this.limit=limit;}public CompletionStage<byte[]> getBody(){return result;}
  public void onSubscribe(Flow.Subscription s){subscription=s;s.request(1);}
  public void onNext(List<ByteBuffer> chunks){for(var chunk:chunks){if(out.size()+chunk.remaining()>limit){subscription.cancel();result.completeExceptionally(new SecurityException("size limit"));return;}byte[] b=new byte[chunk.remaining()];chunk.get(b);out.writeBytes(b);}subscription.request(1);}
  public void onError(Throwable t){result.completeExceptionally(t);}public void onComplete(){result.complete(out.toByteArray());}
 }
}
