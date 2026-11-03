package io.github.coyotewolf.aoi.client;
import io.github.coyotewolf.aoi.AoiAssistantMod;
import io.github.coyotewolf.aoi.config.AssistantConfig;
import io.github.coyotewolf.aoi.update.ReleaseManifest;
import io.github.coyotewolf.aoi.update.UpdateLease;
import io.github.coyotewolf.aoi.update.PrelaunchSetup;
import com.google.gson.JsonObject;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;
import net.minecraftforge.fml.ModList;
import net.minecraftforge.fml.loading.FMLPaths;
import java.net.*;
import java.net.http.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.concurrent.*;

/** Downloads to config, never to mods while Minecraft is running. */
public final class UpdateClient {
 private static final ExecutorService IO=Executors.newSingleThreadExecutor(r->{var t=new Thread(r,"AOI updates");t.setDaemon(true);return t;});
 private static final class Network {static final HttpClient HTTP=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).followRedirects(HttpClient.Redirect.NEVER).build();}
 private static long next=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
 private static boolean busy,staged,checked,setupChecked;
 private static String status="尚未檢查更新。",message="";
 public static String versionInfo(){
  String current=ModList.get().getModContainerById(AoiAssistantMod.ID).orElseThrow().getModInfo().getVersion().toString();
  return "AI 小助手目前載入版本："+current+"（Minecraft 1.20.1／Forge）。\n更新狀態："+status+"\n這是正在執行的版本；已下載但尚未載入的新版不會顯示為目前版本。";
 }
 public static void tick(){
  var mc=Minecraft.getInstance();if(mc.player!=null&&!message.isEmpty()){mc.gui.getChat().addMessage(Component.literal("【小助手更新】"+message).withStyle(ChatFormatting.AQUA));message="";}
  if(!setupChecked&&AssistantConfig.AUTO_UPDATE.get()&&!busy&&System.nanoTime()>=next){
   setupChecked=true;busy=true;
   IO.submit(()->{PrelaunchSetup.Result result;try{result=PrelaunchSetup.install(FMLPaths.GAMEDIR.get());}catch(Exception e){result=new PrelaunchSetup.Result(false,false,"啟動前更新設定未完成；現有更新方式仍可使用。");}
    final var done=result;mc.execute(()->{busy=false;if(done.enabled()){checked=true;status="已啟用啟動前更新；手動檢查仍可用 /ai 更新。";}if(!done.message().isEmpty())message=done.message();});
   });return;
  }
  if(busy||staged||checked||System.nanoTime()<next||!AssistantConfig.AUTO_UPDATE.get())return;
  checked=true;busy=true;IO.submit(()->{String result;boolean applied=false;try{result=check();applied=result.startsWith("已下載");}catch(Exception e){result="更新檢查未完成，現有版本可繼續使用；可用 /ai 更新 重試，或下次啟動再檢查。";}
   final String done=result;final boolean ready=applied;mc.execute(()->{busy=false;staged=ready;status=done;if(ready)message=done;});
  });
 }
 public static String checkNow(){if(!AssistantConfig.AUTO_UPDATE.get())return "自動更新已關閉；可從攻略網站下載，或在模組設定啟用 autoUpdate。";if(staged)return status;if(busy)return "正在檢查更新……";checked=false;next=0;return "開始檢查更新；下載完成會在聊天欄通知，關閉遊戲後套用。";}
 private static String check()throws Exception{
  String current=ModList.get().getModContainerById(AoiAssistantMod.ID).orElseThrow().getModInfo().getVersion().toString();
  var response=fetch(URI.create(ReleaseManifest.FEED),16384,15);if(response.statusCode()!=200)throw new IllegalStateException("feed unavailable");
  var release=ReleaseManifest.verify(new String(response.body(),StandardCharsets.UTF_8),current,Instant.now(),ReleaseManifest.PUBLIC_KEY);
  if(ReleaseManifest.compare(release.version(),current)<=0)return "目前已是最新版本 "+current+"。";
  if(!System.getProperty("os.name","").toLowerCase(java.util.Locale.ROOT).contains("windows"))return "發現新版 "+release.version()+"；此系統請從攻略網站手動更新。";
  Path instance=FMLPaths.GAMEDIR.get().toRealPath(),mods=instance.resolve("mods").toRealPath();
  Path installed=ModList.get().getModFileById(AoiAssistantMod.ID).getFile().getFilePath().toRealPath();
  if(!installed.getParent().equals(mods)||!installed.getFileName().toString().equals("aoi-ai-assistant-1.20.1-"+current+".jar"))return "發現新版 "+release.version()+"；目前使用自訂檔名或開發環境，請手動更新。";
  Path state=instance.resolve("config/aoi_assistant/update");Files.createDirectories(state);try(var lease=UpdateLease.acquire(state)){
  if(lease==null)return "更新暫存正在使用或無法鎖定；不會覆寫，請完全退出遊戲後再檢查。";
  Path stagedFile=state.resolve("staged.jar");
  boolean cached=false;try{release.verifyJar(stagedFile);cached=true;}catch(Exception ignored){}
  if(!cached){var download=fetch(release.url(),(int)release.bytes(),40);if(download.statusCode()!=200)throw new IllegalStateException("download unavailable");
   Path partial=state.resolve("download.part");Files.write(partial,download.body());try{release.verifyJar(partial);Files.move(partial,stagedFile,StandardCopyOption.REPLACE_EXISTING);}finally{Files.deleteIfExists(partial);}
  }
  if(!AssistantConfig.AUTO_UPDATE.get())return "自動更新已關閉，下載尚未套用。";
  var plan=new JsonObject();plan.addProperty("version",release.version());plan.addProperty("sha256",release.sha256());plan.addProperty("bytes",release.bytes());plan.addProperty("oldFile",installed.getFileName().toString());plan.addProperty("oldSha256",ReleaseManifest.hash(installed));plan.addProperty("processStartedAt",ProcessHandle.current().info().startInstant().orElseThrow().toEpochMilli());
  Files.writeString(state.resolve("pending.json"),plan.toString(),StandardCharsets.UTF_8);
  Path script=state.resolve("apply-update.ps1");try(var in=UpdateClient.class.getResourceAsStream("/aoi-update/apply-update.ps1")){if(in==null)throw new IllegalStateException("helper missing");Files.copy(in,script,StandardCopyOption.REPLACE_EXISTING);}
  lease.close(); // The detached helper takes this same lock before reading the plan.
  // Start-Process detaches the fixed local helper. No remote text is shell code.
  String ps=Path.of(System.getenv("SystemRoot"),"System32/WindowsPowerShell/v1.0/powershell.exe").toString();
  String childArgs="-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \""+script+"\" -GameProcessId "+ProcessHandle.current().pid();
  String launch="Start-Process -FilePath '"+ps.replace("'","''")+"' -WindowStyle Hidden -ArgumentList '"+childArgs.replace("'","''")+"'";
  var launcher=new ProcessBuilder(ps,"-NoProfile","-NonInteractive","-WindowStyle","Hidden","-Command",launch).redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD).start();
  if(!launcher.waitFor(10,TimeUnit.SECONDS)){launcher.destroy();throw new IllegalStateException("helper timeout");}if(launcher.exitValue()!=0)throw new IllegalStateException("helper launch");
  return "已下載並驗證 "+release.version()+"。關閉遊戲後自動備份並安裝，下次啟動生效。";
  }
 }
 private static HttpResponse<byte[]> fetch(URI uri,int limit,int timeout)throws Exception{
  var pending=Network.HTTP.sendAsync(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(timeout)).GET().build(),info->new Body(limit));try{return pending.get(timeout+2L,TimeUnit.SECONDS);}catch(Exception e){pending.cancel(true);throw e;}
 }
 private static final class Body implements HttpResponse.BodySubscriber<byte[]> {
  private final int limit;private final CompletableFuture<byte[]> done=new CompletableFuture<>();private final java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();private Flow.Subscription subscription;
  Body(int limit){this.limit=limit;}public CompletionStage<byte[]> getBody(){return done;}public void onSubscribe(Flow.Subscription s){subscription=s;s.request(1);}
  public void onNext(java.util.List<java.nio.ByteBuffer> chunks){for(var chunk:chunks){if(bytes.size()+chunk.remaining()>limit){subscription.cancel();done.completeExceptionally(new SecurityException("download size"));return;}byte[] b=new byte[chunk.remaining()];chunk.get(b);bytes.writeBytes(b);}subscription.request(1);}
  public void onError(Throwable e){done.completeExceptionally(e);}public void onComplete(){done.complete(bytes.toByteArray());}
 }
 private UpdateClient(){}
}
