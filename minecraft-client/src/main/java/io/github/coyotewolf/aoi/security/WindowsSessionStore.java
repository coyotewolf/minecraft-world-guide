package io.github.coyotewolf.aoi.security;

import com.google.gson.*;
import com.sun.jna.Platform;
import com.sun.jna.platform.win32.Crypt32Util;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Arrays;

/** DPAPI current-user scope; only ciphertext ever touches disk. */
public final class WindowsSessionStore implements SessionStore {
 private final Path file;
 private final byte[] entropy;
 public WindowsSessionStore(Path file,String service){
  this.file=file.toAbsolutePath().normalize();
  entropy=("AOI assistant session v1\n"+service).getBytes(StandardCharsets.UTF_8);
 }
 @Override public JsonObject load() throws IOException {
  if(!Files.exists(file))return null;
  if(!Platform.isWindows())throw new IOException("記住登入目前只支援 Windows。");
  if(Files.size(file)>65536)throw new IOException("保存的登入資料無效。");
  byte[] plain=null;
  try{
   plain=Crypt32Util.cryptUnprotectData(Files.readAllBytes(file),entropy,4,null);
   return JsonParser.parseString(new String(plain,StandardCharsets.UTF_8)).getAsJsonObject();
  }catch(RuntimeException|LinkageError e){throw new IOException("無法讀取保存的登入，請重新登入。");}
  finally{if(plain!=null)Arrays.fill(plain,(byte)0);}
 }
 @Override public void save(JsonObject saved) throws IOException {
  if(!Platform.isWindows())throw new IOException("記住登入目前只支援 Windows。");
  byte[] plain=saved.toString().getBytes(StandardCharsets.UTF_8),encrypted;
  try{encrypted=Crypt32Util.cryptProtectData(plain,entropy,4,"AOI assistant login",null);}
  catch(RuntimeException|LinkageError e){throw new IOException("無法加密保存登入。");}
  finally{Arrays.fill(plain,(byte)0);}
  Files.createDirectories(file.getParent());
  Path temp=Files.createTempFile(file.getParent(),"session-",".tmp");
  try{
   Files.write(temp,encrypted);
   try{Files.move(temp,file,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}
   catch(AtomicMoveNotSupportedException e){Files.move(temp,file,StandardCopyOption.REPLACE_EXISTING);}
  }finally{Files.deleteIfExists(temp);}
 }
 @Override public void delete() throws IOException {
  try{Files.deleteIfExists(file);}
  catch(IOException failure){
   // If deletion is blocked but replacement works, invalidate the saved session.
   try{save(new JsonObject());}catch(IOException ignored){throw new IOException("無法清除保存的登入資料。");}
  }
 }
}
