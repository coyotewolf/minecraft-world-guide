package io.github.coyotewolf.aoichecks;
import io.github.coyotewolf.aoi.update.PrelaunchSetup;
import java.nio.file.*;

public class PrelaunchSetupChecks {
 static int checks;
 static void check(boolean value,String name){if(!value)throw new AssertionError(name);checks++;}
 static Path fixture(String global,String pre)throws Exception {
  Path launcher=Files.createTempDirectory("aoi-launcher-setup-");Files.write(launcher.resolve("MultiMC.exe"),new byte[0]);Files.writeString(launcher.resolve("multimc.cfg"),global);
  Path game=launcher.resolve("instances/test/.minecraft");Files.createDirectories(game.resolve("mods"));
  Files.writeString(game.getParent().resolve("instance.cfg"),"name=Test\nOverrideCommands=false\nPreLaunchCommand="+pre+"\nPostExitCommand=\nWrapperCommand=\nMaxMemAlloc=8192\n");return game;
 }
 public static void main(String[] args)throws Exception {
  if(!System.getProperty("os.name").startsWith("Windows")){System.out.println("Prelaunch setup verification skipped: Windows only");return;}
  Path game=fixture("JavaPath=javaw\n","");var first=PrelaunchSetup.install(game);
  check(first.enabled()&&first.changed(),"automatic installation");
  Path root=game.resolve("config/aoi_assistant/prelaunch");String cfg=Files.readString(game.getParent().resolve("instance.cfg"));
  check(cfg.contains("OverrideCommands=true")&&cfg.contains("$INST_MC_DIR/config/aoi_assistant/prelaunch/prelaunch.ps1"),"launcher hook");
  check(cfg.contains("MaxMemAlloc=8192"),"other settings preserved");
  check(Files.size(root.resolve("updater.jar"))>10000&&Files.exists(root.resolve("finalize-settings.ps1")),"embedded resources extracted");
  try(var paths=Files.list(root)){check(paths.anyMatch(p->p.getFileName().toString().startsWith("launcher-settings-")),"settings backup");}
  check(!PrelaunchSetup.install(game).changed(),"idempotent setup");
  Files.write(root.resolve("updater.jar"),new byte[0]);check(PrelaunchSetup.install(game).changed()&&Files.size(root.resolve("updater.jar"))>10000,"damaged helper repaired");
  game=fixture("JavaPath=javaw\n","other-updater.exe");Path config=game.getParent().resolve("instance.cfg");String before=Files.readString(config);
  check(!PrelaunchSetup.install(game).enabled(),"custom instance hook preserved");check(Files.readString(config).equals(before),"instance settings unchanged on conflict");
  game=fixture("PreLaunchCommand=other-updater.exe\n","");config=game.getParent().resolve("instance.cfg");before=Files.readString(config);
  check(!PrelaunchSetup.install(game).enabled(),"global hook preserved");check(Files.readString(config).equals(before),"global conflict leaves settings unchanged");
  game=Files.createTempDirectory("aoi-not-multimc-");check(!PrelaunchSetup.install(game).enabled(),"unsupported launcher fallback");
  System.out.println("Prelaunch setup verification passed: "+checks+" checks");
 }
}
