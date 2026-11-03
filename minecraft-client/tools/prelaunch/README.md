# 啟動前自動更新（MultiMC／Windows／Java 17）

每次按啟動：MultiMC 等待更新器 → 取得正式簽章清單 → 有新版時下載、驗證、備份並替換 AOI 模組 → 同次啟動載入新版。無須為更新再重開遊戲。

這是啟動器掛鉤，不是熱更新。已開始執行的 Forge 無法替換已載入的模組。模組下載仍是既有單一 JAR；本機額外安裝小型更新器與固定腳本，朋友若要相同行為也需一次設定自己的啟動器。

建立：執行 `build.ps1 -Jdk <Java17目錄> -Gson <gson-2.10.jar>`。安裝：`install.ps1 -Instance <MultiMC實例目錄>`。腳本保留其他設定，遇到既有啟動指令則停止，不覆蓋。設定備份位於 `.minecraft/config/aoi_assistant/prelaunch/launcher-settings-*.cfg`。

若安裝時 MultiMC 正在開啟，正常退出遊戲、完全關閉 MultiMC 後再打開一次。安裝器會在原 MultiMC 程序退出後重新合併掛鉤，防止舊快取覆寫；不會終止遊戲或啟動器。等待程序最多一天。

## 驗證與限制

- 同一套 Ed25519 信任公鑰、SHA-256、JAR 內模組 ID／版本驗證；固定 HTTPS 網址，不允許重新導向，限制時間與大小。
- 以既有更新鎖協調關閉後更新器；同實例仍執行、多個 AOI JAR、自訂檔名、關閉 autoUpdate 時跳過。
- 舊版保存在 `.minecraft/aoi-assistant-backups/prelaunch-*`。下載／驗證失敗保留舊版；替換失败嘗試回復，回復失敗則停止啟動並提示備份位置。
- 沒有週期背景檢查，啟動前最多一次。沒有登入憑證、AI 查詢或計費。
- 已有遊戲內 `/ai 更新` 仍沿用關閉後套用；啟動器正常檢查時已更新到最新版，因此舊遊戲內自動檢查通常只會確認版本。
- 本機更新器本身不會自動下載遠端腳本；更新信任邏輯時需重新安裝更新器。

移除：在 MultiMC 實例設定的自訂指令清空這段啟動前指令，或關閉 MultiMC 後恢復設定備份。不要把 `updater.jar` 放進 mods。

MultiMC 官方文件確認啟動前指令會等待完成，並提供 INST_JAVA／INST_MC_DIR：[Instance settings](https://github.com/MultiMC/Launcher/wiki/Instance-settings)。
