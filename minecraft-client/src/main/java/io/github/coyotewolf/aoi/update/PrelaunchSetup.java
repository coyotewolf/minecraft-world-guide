package io.github.coyotewolf.aoi.update;

import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Installs fixed, embedded launcher resources. Never interprets downloaded script text. */
public final class PrelaunchSetup {
 public record Result(boolean enabled,boolean changed,String message){}
 public static Result install(Path game)throws Exception {
  if(!System.getProperty("os.name","").toLowerCase(Locale.ROOT).contains("windows"))return new Result(false,false,"");
  game=game.toRealPath();Path instance=game.getParent();
  if(!game.getFileName().toString().equals(".minecraft")||!Files.isRegularFile(instance.resolve("instance.cfg")))return new Result(false,false,"");
  Path launcher=instance.getParent().getParent();
  if(!Files.isRegularFile(launcher.resolve("multimc.cfg"))||!Files.isRegularFile(launcher.resolve("MultiMC.exe")))return new Result(false,false,"");
  Path folder=game.resolve("config/aoi_assistant/prelaunch"),stamp=folder.resolve("embedded-version.txt");
  var assets=new LinkedHashMap<String,byte[]>();var digest=java.security.MessageDigest.getInstance("SHA-256");
  for(String name:List.of("build/updater.jar","install.ps1","prelaunch.ps1","finalize-settings.ps1")) {
   try(var in=PrelaunchSetup.class.getResourceAsStream("/aoi-update/prelaunch/"+name)){if(in==null)throw new IllegalStateException("missing embedded updater");byte[] bytes=in.readNBytes(2097153);if(bytes.length>2097152)throw new SecurityException("embedded resource size");assets.put(name,bytes);digest.update(bytes);}
  }
  String expected=HexFormat.of().formatHex(digest.digest())+"\n";
  String cfg=Files.readString(instance.resolve("instance.cfg"));
  if(Files.exists(stamp)&&Files.readString(stamp).equals(expected)&&cfg.contains("aoi_assistant/prelaunch/prelaunch.ps1")&&cfg.matches("(?s).*\\bOverrideCommands=true\\b.*")&&Files.isRegularFile(folder.resolve("updater.jar"))&&ReleaseManifest.hash(folder.resolve("updater.jar")).equals(HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(assets.get("build/updater.jar")))))return new Result(true,false,"");
  Files.createDirectories(folder);
  if(!folder.toRealPath().equals(folder))throw new SecurityException("redirected setup directory");
  Path packageDir=Files.createTempDirectory(folder,"embedded-");
  try {
   for(String name:assets.keySet()) {
    Path file=packageDir.resolve(name);Files.createDirectories(file.getParent());
    Files.write(file,assets.get(name));
   }
   Path ps=Path.of(System.getenv("SystemRoot"),"System32/WindowsPowerShell/v1.0/powershell.exe");
   Path log=folder.resolve("setup.log");
   var process=new ProcessBuilder(ps.toString(),"-NoProfile","-NonInteractive","-WindowStyle","Hidden","-ExecutionPolicy","Bypass","-File",packageDir.resolve("install.ps1").toString(),"-Instance",instance.toString()).redirectErrorStream(true).redirectOutput(log.toFile()).start();
   if(!process.waitFor(25,TimeUnit.SECONDS)){process.destroy();throw new IllegalStateException("launcher setup timed out");}
   if(process.exitValue()!=0)return new Result(false,false,"啟動前更新尚未設定：可能已有其他啟動指令；原設定已保留。詳情見 config/aoi_assistant/prelaunch/setup.log。");
   Files.writeString(stamp,expected);
   return new Result(true,true,"已自動設定啟動前更新。請正常退出遊戲並完整關閉 MultiMC 一次；之後開遊戲會先更新，同次使用新版。");
  }finally {
   try(var paths=Files.walk(packageDir)){for(Path path:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}
  }
 }
 private PrelaunchSetup(){}
}
