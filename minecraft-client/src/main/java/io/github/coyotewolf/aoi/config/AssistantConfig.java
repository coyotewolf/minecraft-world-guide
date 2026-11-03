package io.github.coyotewolf.aoi.config;

import java.net.URI;
import net.minecraftforge.common.ForgeConfigSpec;

public final class AssistantConfig {
 public static final ForgeConfigSpec SPEC;
 public static final ForgeConfigSpec.BooleanValue ANNOUNCEMENTS, AUTO_UPDATE;
 public static final ForgeConfigSpec.ConfigValue<String> WORKER, SUPABASE, PUBLIC_KEY;
 static {
  var b=new ForgeConfigSpec.Builder();
  b.comment("此設定只保存服務網址與公開金鑰。登入憑證另以 Windows 加密保存在 aoi_assistant/session.dpapi；不保存密碼或聊天內容。");
  WORKER=b.define("aiEndpoint","https://aoi-free-guide.aoi-free-cloud-guide.workers.dev",AssistantConfig::https);
  SUPABASE=b.define("supabaseUrl","https://pfrnxaitloaiemrerhcn.supabase.co",AssistantConfig::https);
  PUBLIC_KEY=b.define("publishableKey","sb_publishable_VbCO9ufRfxSZT8w7N7UtnA_zP5mkFgq",v->v instanceof String s&&s.startsWith("sb_publishable_")&&s.length()<300);
  ANNOUNCEMENTS=b.comment("進入世界時約每分鐘接收公開公告；不傳送帳號或世界資料。關閉後停止檢查。").define("receiveAnnouncements",true);
  AUTO_UPDATE=b.comment("每次啟動時背景檢查一次官方簽章更新；Windows 在關閉遊戲後備份並替換 JAR，下次啟動生效。").define("autoUpdate",true);
  SPEC=b.build();
 }
 public static boolean https(Object value){
  try {var u=URI.create(String.valueOf(value));return "https".equals(u.getScheme())&&u.getHost()!=null&&u.getUserInfo()==null&&u.getQuery()==null&&u.getFragment()==null;}catch(Exception e){return false;}
 }
 private AssistantConfig(){}
}
