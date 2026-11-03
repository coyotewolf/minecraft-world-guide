package io.github.coyotewolf.aoi.client;

import com.google.gson.JsonParser;
import io.github.coyotewolf.aoi.config.AssistantConfig;
import io.github.coyotewolf.aoi.model.AnnouncementPolicy;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;
import net.minecraftforge.fml.loading.FMLPaths;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.concurrent.*;

/** One independent, daemon network queue. Tick never waits on network or disk. */
public final class AnnouncementClient {
 private static final ExecutorService IO=Executors.newSingleThreadExecutor(r->{var t=new Thread(r,"AOI announcements");t.setDaemon(true);return t;});
 private static final class Network {static final HttpClient HTTP=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();}
 private static final AnnouncementPolicy POLICY=new AnnouncementPolicy();
 private static final Path STATE=FMLPaths.CONFIGDIR.get().resolve("aoi_assistant/announcements-seen.txt");
 private static Object world;
 private static long epoch,next;
 private static boolean running,loaded;
 private static String etag="",endpoint="";
 private static Future<?> task;
 public static void tick(){
  var mc=Minecraft.getInstance();Object current=mc.player!=null&&AssistantConfig.ANNOUNCEMENTS.get()?mc.level:null;
  if(current!=world){world=current;epoch++;running=false;etag="";if(task!=null)task.cancel(true);next=System.nanoTime()+TimeUnit.SECONDS.toNanos(ThreadLocalRandom.current().nextInt(5,21));}
  if(world==null||running||System.nanoTime()<next)return;
  String url=AssistantConfig.WORKER.get();if(!url.equals(endpoint)){endpoint=url;etag="";}
  final long lease=epoch;final String match=etag;running=true;
  task=IO.submit(()->{
   try{
    if(!loaded){try{if(Files.isRegularFile(STATE)&&Files.size(STATE)<=20000)POLICY.restore(Files.readString(STATE));}catch(Exception ignored){}loaded=true;}
    var uri=URI.create(url.replaceAll("/+$","")+"/announcements");if(!AssistantConfig.https(url))throw new IllegalArgumentException("HTTPS required");
    var builder=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(8)).header("Accept","application/json").GET();if(!match.isEmpty())builder.header("If-None-Match",match);
    var pending=Network.HTTP.sendAsync(builder.build(),info->new AnnouncementBody());
    HttpResponse<byte[]> response;
    try{response=pending.get(10,TimeUnit.SECONDS);}catch(Exception e){pending.cancel(true);throw e;}
    if(response.statusCode()!=200&&response.statusCode()!=304)throw new IllegalStateException("unavailable");
    var notices=response.statusCode()==200?AnnouncementPolicy.parse(JsonParser.parseString(new String(response.body(),StandardCharsets.UTF_8))):java.util.List.<AnnouncementPolicy.Notice>of();
    String received=response.headers().firstValue("ETag").orElse("");if(received.length()>100)received="";final String tag=received;
    mc.execute(()->{
     if(lease!=epoch||mc.level!=world||mc.player==null||!AssistantConfig.ANNOUNCEMENTS.get())return;
     etag=tag;
     var unread=POLICY.unread(notices,Instant.now());
     for(var notice:unread){
      // Literal text prevents URLs, click actions or server commands supplied by a feed.
      mc.gui.getChat().addMessage(Component.literal("【公告】"+notice.title()+" — "+notice.body()).withStyle(ChatFormatting.GOLD));
      POLICY.acknowledge(notice.id());
     }
     if(!unread.isEmpty()){String stored=POLICY.snapshot();IO.submit(()->save(stored));}finish(true);
    });
   }catch(Exception ignored){mc.execute(()->{if(lease==epoch)finish(false);});}
  });
 }
 private static void finish(boolean success){running=false;next=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(POLICY.delayMillis(success,ThreadLocalRandom.current().nextInt(15001)));}
 private static void save(String stored){try{Files.createDirectories(STATE.getParent());Path temp=STATE.resolveSibling("announcements-seen.tmp");Files.writeString(temp,stored,StandardCharsets.UTF_8);try{Files.move(temp,STATE,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);}catch(AtomicMoveNotSupportedException e){Files.move(temp,STATE,StandardCopyOption.REPLACE_EXISTING);}}catch(Exception ignored){}}
 private static final class AnnouncementBody implements HttpResponse.BodySubscriber<byte[]> {
  private final CompletableFuture<byte[]> result=new CompletableFuture<>();private final java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();private Flow.Subscription subscription;
  public CompletionStage<byte[]> getBody(){return result;}
  public void onSubscribe(Flow.Subscription s){subscription=s;s.request(1);}
  public void onNext(java.util.List<java.nio.ByteBuffer> chunks){for(var chunk:chunks){if(bytes.size()+chunk.remaining()>65536){subscription.cancel();result.completeExceptionally(new IllegalStateException("feed too large"));return;}byte[] b=new byte[chunk.remaining()];chunk.get(b);bytes.writeBytes(b);}subscription.request(1);}
  public void onError(Throwable e){result.completeExceptionally(e);}public void onComplete(){result.complete(bytes.toByteArray());}
 }
 private AnnouncementClient(){}
}
