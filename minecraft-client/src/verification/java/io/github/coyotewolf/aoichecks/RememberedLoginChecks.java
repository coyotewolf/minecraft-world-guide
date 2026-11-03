package io.github.coyotewolf.aoichecks;

import io.github.coyotewolf.aoi.security.*;
import io.github.coyotewolf.aoi.net.*;
import io.github.coyotewolf.aoi.model.Models;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Real Windows DPAPI and separate JVM restarts; only disposable mock tokens. */
public final class RememberedLoginChecks {
 private static final String SCOPE="https://db.example\nhttps://ai.example\npublic";
 private static void require(boolean ok,String label){if(!ok)throw new AssertionError(label);System.out.println("REMEMBER PASS "+label);}
 private static AssistantApi api(ClientChecks.Fake fake,SessionManager manager){return new AssistantApi("https://ai.example","https://db.example","public",manager,fake);}
 private static WindowsSessionStore store(Path file){return new WindowsSessionStore(file,SCOPE);}
 private static void child(String mode,Path file)throws Exception{
  String java=Path.of(System.getProperty("java.home"),"bin","java.exe").toString();
  var p=new ProcessBuilder(java,"-cp",System.getProperty("java.class.path"),RememberedLoginChecks.class.getName(),mode,file.toString()).inheritIO().start();
  require(p.waitFor()==0,"separate JVM "+mode+" completed");
 }
 public static void main(String[] args)throws Exception{
  if(args.length>0){
   Path file=Path.of(args[1]);var saved=store(file);var manager=new SessionManager(saved);var fake=new ClientChecks.Fake();var a=api(fake,manager);
   if(args[0].equals("seed")){
    require(manager.get()==null,"first launch needs login");a.login("test","mock-password");
    require(Files.exists(file),"successful login writes protected credential");
    String binary=new String(Files.readAllBytes(file),StandardCharsets.ISO_8859_1);
    require(!binary.contains("mock-refresh")&&!binary.contains("mock-token")&&!binary.contains("mock-password"),"disk contains no plaintext token or password");
    long lease=manager.generation();manager.release();require(Files.exists(file)&&manager.get()==null,"program exit retains encrypted login only");
    try{manager.install(fake.session(),lease);throw new AssertionError();}catch(java.util.concurrent.CancellationException expected){require(true,"late response cannot restore closed session");}
   }else{
    require(manager.get()!=null&&manager.get().accessToken.isEmpty()&&manager.get().expiresAt==0,"new JVM restores refresh credential without trusting cached access");
    a.active();require(fake.refreshes==1,"restored login refreshes online before account check");
    var json=saved.load();require(json.get("refresh_token").getAsString().equals("mock-refresh-1"),"rotated refresh token replaces saved credential");
    require(!json.has("access_token")&&!json.has("password"),"saved payload contains only refresh credential and identity");
    a.logout();require(!Files.exists(file)&&manager.get()==null,"explicit logout removes saved login");
    require(new SessionManager(saved).get()==null,"restart after logout stays signed out");
   }
   return;
  }
  Path root=Files.createTempDirectory(Path.of("build"),"remember-login-");Path file=root.resolve("session.dpapi");
  try{
   child("seed",file);child("restore",file);
   var original=new SessionManager(store(file));var fake=new ClientChecks.Fake();api(fake,original).login("test","mock-password");original.release();
   var offline=new SessionManager(store(file));
   var unavailable=new AssistantApi("https://ai.example","https://db.example","public",offline,(m,u,h,b,t)->new Transport.Reply(503,Models.obj("error","offline")));
   try{unavailable.active();throw new AssertionError();}catch(ApiException expected){require(expected.status==503&&Files.exists(file)&&offline.get()!=null,"temporary outage preserves saved login for retry");}
   api(new ClientChecks.Fake(),offline).active();require(offline.get()!=null,"connection recovery needs no password");
   var rejected=new ClientChecks.Fake();rejected.active=false;
   try{api(rejected,offline).active();throw new AssertionError();}catch(ApiException expected){require(expected.status==403&&!Files.exists(file)&&offline.get()==null,"revoked account clears remembered login");}
   var invalid=new SessionManager(store(file));api(new ClientChecks.Fake(),invalid).login("test","mock-password");invalid.release();
   var revoked=new SessionManager(store(file));
   var badToken=new AssistantApi("https://ai.example","https://db.example","public",revoked,(m,u,h,b,t)->new Transport.Reply(400,Models.obj("error","invalid refresh")));
   try{badToken.active();throw new AssertionError();}catch(ApiException expected){require(!Files.exists(file)&&revoked.get()==null,"expired or revoked refresh token clears disk");}
   var good=new SessionManager(store(file));api(new ClientChecks.Fake(),good).login("test","mock-password");good.release();
   Path mismatched=root.resolve("other-service.dpapi");Files.copy(file,mismatched);
   var changedService=new SessionManager(new WindowsSessionStore(mismatched,SCOPE+"-other"));
   require(changedService.get()==null&&!Files.exists(mismatched)&&Files.exists(file),"credentials cannot migrate to a different service configuration");
   Files.write(file,new byte[]{1,2,3,4});var damaged=new SessionManager(store(file));
   require(damaged.get()==null&&!Files.exists(file)&&!damaged.storageNotice().isBlank(),"corrupt ciphertext recovers with clean login prompt");
   SessionStore broken=new SessionStore(){public com.google.gson.JsonObject load(){return null;}public void save(com.google.gson.JsonObject j)throws java.io.IOException{throw new java.io.IOException();}public void delete(){}};
   var noDisk=new SessionManager(broken);api(new ClientChecks.Fake(),noDisk).login("test","mock-password");
   require(noDisk.get()!=null&&!noDisk.storageNotice().isBlank(),"storage failure keeps current login and reports it was not remembered");
   System.out.println("Remembered login verification passed: native DPAPI, separate JVM restart, rotation, offline retry, revocation, logout and corruption.");
  }finally{Files.deleteIfExists(file);Files.deleteIfExists(root.resolve("other-service.dpapi"));Files.deleteIfExists(root);}
 }
}
