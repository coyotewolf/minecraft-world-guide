package io.github.coyotewolf.aoi.security;

import com.google.gson.JsonObject;
import io.github.coyotewolf.aoi.model.Models;
import java.time.Instant;

public final class SessionManager {
 // Deliberately not a record: never generate a toString containing credentials.
 public static final class Session {
  public final String userId,accessToken,refreshToken;
  public final long expiresAt;
  private Session(String user,String access,String refresh,long expiry){userId=user;accessToken=access;refreshToken=refresh;expiresAt=expiry;}
  @Override public String toString(){return "Session[redacted]";}
 }
 private volatile Session current;
 private volatile long generation;
 private final SessionStore store;
 private volatile String storageNotice="";
 public SessionManager(){this(SessionStore.MEMORY);}
 public SessionManager(SessionStore store){
  this.store=store;
  try{
   var saved=store.load();if(saved==null)return;
   String uid=Models.uuid(Models.text(saved,"user_id",null)),refresh=Models.text(saved,"refresh_token","");
   if(refresh.isBlank()||refresh.length()>16000)throw new IllegalArgumentException();
   // Never trust a cached access token: the first request must refresh online.
   current=new Session(uid,"",refresh,0);
  }catch(Exception e){
   storageNotice="保存的登入無法讀取，請重新登入。";
   try{store.delete();}catch(Exception ignored){storageNotice="保存的登入無法讀取或清除，請重新登入。";}
  }
 }
 public synchronized void clear(){
  current=null;generation++;
  try{store.delete();storageNotice="";}catch(Exception e){storageNotice="無法清除保存的登入資料；請檢查設定資料夾權限。";}
 }
 /** Closing the program must not perform sign-out or erase the saved session. */
 public synchronized void release(){current=null;generation++;}
 public String storageNotice(){return storageNotice;}
 public Session get(){return current;}
 public long generation(){return generation;}
 public synchronized void install(JsonObject data,long expected){
  if(generation!=expected)throw new java.util.concurrent.CancellationException();
  String access=Models.text(data,"access_token","");String refresh=Models.text(data,"refresh_token","");
  if(access.isBlank()||refresh.isBlank()||!data.has("user")||!data.get("user").isJsonObject())throw new IllegalArgumentException("登入資料格式異常。");
  String uid=Models.uuid(Models.text(data.getAsJsonObject("user"),"id",null));
  if(current!=null&&!current.userId.equals(uid))throw new IllegalArgumentException("登入帳號已變更，請重新登入。");
  long expiry=data.has("expires_at")?data.get("expires_at").getAsLong():Instant.now().getEpochSecond()+(data.has("expires_in")?data.get("expires_in").getAsLong():3600);
  current=new Session(uid,access,refresh,expiry);
  try{store.save(Models.obj("version",1,"user_id",uid,"refresh_token",refresh));storageNotice="";}
  catch(Exception e){storageNotice="本次已登入，但無法保存登入；重開遊戲需再登入。";}
 }
}
