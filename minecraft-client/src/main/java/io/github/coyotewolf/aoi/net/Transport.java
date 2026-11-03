package io.github.coyotewolf.aoi.net;

import com.google.gson.*;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.util.Map;
import java.util.List;
import java.util.concurrent.*;

@FunctionalInterface
public interface Transport {
 record Reply(int status,JsonElement body) {}
 Reply request(String method,URI uri,Map<String,String> headers,JsonElement body,int timeoutSeconds);
 static Transport https(){
  var client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(12)).followRedirects(HttpClient.Redirect.NEVER).build();
  return (method,uri,headers,body,timeout)->{
   if(!"https".equals(uri.getScheme()))throw new ApiException(0,"僅支援 HTTPS 連線。","");
   var b=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(timeout));
   headers.forEach(b::header);b.header("Accept","application/json");
   if(body!=null)b.header("Content-Type","application/json");
   var publisher=body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body.toString(),StandardCharsets.UTF_8);
   b.method(method,publisher);
   // This method is invoked only on ChatController's dedicated network executor.
   var future=client.sendAsync(b.build(),info->new LimitedBody());
   try {
    var r=future.get(timeout+2L,TimeUnit.SECONDS);
    String raw=new String(r.body(),StandardCharsets.UTF_8);
    JsonElement parsed=raw.isBlank()?JsonNull.INSTANCE:JsonParser.parseString(raw);
    return new Reply(r.statusCode(),parsed);
   }catch(ApiException e){throw e;}catch(InterruptedException e){future.cancel(true);Thread.currentThread().interrupt();throw new CancellationException();}
   catch(ExecutionException e){future.cancel(true);if(e.getCause() instanceof ApiException api)throw api;throw new ApiException(0,"無法連線，請重試。","");}
   catch(Exception e){future.cancel(true);throw new ApiException(0,"網路逾時或無法連線；訊息仍保留，請重試。","");}
  };
 }
 final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {
  private final CompletableFuture<byte[]> done=new CompletableFuture<>();
  private final ByteArrayOutputStream bytes=new ByteArrayOutputStream();
  private Flow.Subscription subscription;
  @Override public CompletionStage<byte[]> getBody(){return done;}
  @Override public void onSubscribe(Flow.Subscription s){subscription=s;s.request(1);}
  @Override public void onNext(List<ByteBuffer> items){
   for(var item:items){
    if(bytes.size()+item.remaining()>2_000_000){subscription.cancel();done.completeExceptionally(new ApiException(0,"回傳資料過大，請縮小查詢。",""));return;}
    byte[] chunk=new byte[item.remaining()];item.get(chunk);bytes.writeBytes(chunk);
   }
   subscription.request(1);
  }
  @Override public void onError(Throwable error){done.completeExceptionally(error);}
  @Override public void onComplete(){done.complete(bytes.toByteArray());}
 }
}
