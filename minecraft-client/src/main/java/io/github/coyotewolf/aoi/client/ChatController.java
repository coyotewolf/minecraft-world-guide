package io.github.coyotewolf.aoi.client;

import io.github.coyotewolf.aoi.config.AssistantConfig;
import io.github.coyotewolf.aoi.net.*;
import io.github.coyotewolf.aoi.security.SessionManager;
import io.github.coyotewolf.aoi.security.WindowsSessionStore;
import io.github.coyotewolf.aoi.sync.ChatSyncService;
import net.minecraft.client.Minecraft;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

public final class ChatController {
 private static ChatController instance;
 public static ChatController get(){if(instance==null)instance=new ChatController();return instance;}
 public final SessionManager sessions;
 public final ChatSyncService service;
 private ChatController(){
  this(new AssistantApi(AssistantConfig.WORKER.get(),AssistantConfig.SUPABASE.get(),AssistantConfig.PUBLIC_KEY.get(),
   new SessionManager(new WindowsSessionStore(net.minecraftforge.fml.loading.FMLPaths.CONFIGDIR.get().resolve("aoi_assistant/session.dpapi"),AssistantConfig.SUPABASE.get()+"\n"+AssistantConfig.WORKER.get()+"\n"+AssistantConfig.PUBLIC_KEY.get())),Transport.https()));
  if(sessions.get()!=null)run("正在恢復登入……",false,service::restore,r->{if(r.success())io.github.coyotewolf.aoi.client.commands.ChatCommands.loginReady();});
 }
 ChatController(AssistantApi api){api.searchHandler(NearbyEntities::fromAi);api.registryHandler(RegistryIds::fromAi);api.biomeHandler(CurrentBiome::fromAi);sessions=api.sessions;service=new ChatSyncService(api);}
 private final ExecutorService executor=Executors.newSingleThreadExecutor(r->{Thread t=new Thread(r,"AOI network");t.setDaemon(true);return t;});
 private final AtomicLong epoch=new AtomicLong();
 private Future<?> running;
 public boolean busy,deleting;
 public String notice="";
 public final Map<String,String> drafts=new ConcurrentHashMap<>();
 @FunctionalInterface public interface Action {void run(Runnable check);}
 public record Outcome(ChatSyncService.View view,String status,boolean success){}
 public void run(String waiting,boolean deletion,Action action){
  run(waiting,deletion,action,outcome->{});
 }
 public boolean run(String waiting,boolean deletion,Action action,Consumer<Outcome> completion){
  if(busy)return false;
  long lease=epoch.incrementAndGet();busy=true;deleting=deletion;notice=waiting;
  Runnable check=()->{if(Thread.currentThread().isInterrupted()||epoch.get()!=lease)throw new CancellationException();};
  running=executor.submit(()->{
   String status;boolean success;
   try{check.run();action.run(check);check.run();status=service.view().status();success=true;}
   catch(CancellationException e){return;}
   catch(ApiException e){status=e.display();service.publish(status);success=false;}
   catch(Exception e){status="資料格式或同步異常；內容已保留，請重試或重新登入。";service.publish(status);success=false;}
   String completed=status;
   boolean succeeded=success;
   Minecraft.getInstance().execute(()->{if(epoch.get()!=lease)return;busy=false;deleting=false;notice=completed;completion.accept(new Outcome(service.view(),completed,succeeded));});
  });
  return true;
 }
 public void cancel(){
  if(deleting)return;
  epoch.incrementAndGet();if(running!=null)running.cancel(true);if(!service.view().loggedIn())sessions.clear();busy=false;notice="已取消等待。雲端可能仍在處理；重試會沿用同一提問 ID。";
 }
 public void logout(){
  if(deleting)return;
  cancel();drafts.clear();
  // Capture and revoke the session on the same serialized queue; no new requests can start meanwhile.
  run("正在登出……",false,check->{service.logout();check.run();});
 }
 public void shutdown(){epoch.incrementAndGet();sessions.release();drafts.clear();executor.shutdownNow();}
}
