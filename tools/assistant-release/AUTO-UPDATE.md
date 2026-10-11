# 統一發布與自動更新（0.1.7）

玩家需先手動安裝一次 0.1.7。往後 Windows 會背景檢查官方版本、下載並驗證、等待遊戲關閉後備份及替換 JAR，下次啟動生效。不會強制關遊戲或修改其他模組、登入設定、聊天資料。現有 0.1.6 以下沒有更新器，無法直接取得此功能。

支援目前 Windows／MultiMC；使用 Forge 提供的實例路徑，因此其他 Windows 啟動器也可使用相同機制，但尚未逐一實機驗收。自訂 JAR 檔名或開發環境會停止自動替換；Linux／macOS 保留手動更新。正常安裝檔名為 `aoi-ai-assistant-1.20.1-版本.jar`，不要同時放兩版。

## 玩家操作與負荷

- 啟動後約 20～90 秒檢查，以後每 6 小時檢查一次；錯誤隔 1 小時重試。
- `/ai 更新` 或 `/ai update` 可立即檢查，不需登入 AI；有新版本時在聊天室通知。
- `config/aoi_assistant-client.toml` 中 `autoUpdate=false` 可關閉。已下載但尚未套用時關閉此設定，替換工具也會停止。
- 更新清單由 GitHub Pages 快取提供，不呼叫 AI 或公告 Worker，不消耗 AI 配額。下載與驗證都在背景執行緒；正常情況只讀取小型清單，有新版才下載 JAR。
- 新版暫存 `config/aoi_assistant/update/staged.jar`。替換時會把舊檔保存到 `aoi-assistant-backups/auto-版本-UUID/`。錯誤詳情存於 `config/aoi_assistant/update/result.json`，失敗保留現有版本及暫存檔。
- 替換助手僅在有已下載更新時啟動，用程序結束事件等待，不持續輪詢遊戲。最多等待 24 小時；系統關機或安全軟體阻擋時保留暫存，下次檢查再安排。

## 發布新版

在目前專案根目錄執行一個命令，`Site` 要指向已取得最新 `main` 的攻略網站 Git 工作目錄：

```powershell
& .\outputs\minecraft-world-guide\minecraft-client\tools\release.ps1 -Site .\work\site-auto-update -Version 0.1.8 -Publish
```

這會設定版本、執行客戶端／指令／公告／簽章測試及隔離替換測試、產生正式 JAR／原始碼／SHA256、簽署更新清單、更新網站下載入口，提交指定的發布檔案並推送。既有 Pages CI 驗證通過後公開。若省略 `-Publish`，只準備檔案供審查，不推送；發布前更新 CHANGELOG 說明本版變更。

發布工具拒絕覆蓋不同內容的既有版本，請增加版本號。更新清單有效 180 天；若長期沒有新版本，可對同一未變動 JAR 重新執行工具刷新清單，不需改玩家的 JAR。不要在有其他已暫存 Git 變更時發布；工具會拒絕，以免混入不相關內容。

## 簽章與憑證

更新清單使用 Ed25519 簽章；模組內只放公開驗證金鑰。私鑰位於 `%LOCALAPPDATA%\AOI\Deployment\updates\release-ed25519.pkcs8`，只允許本人、SYSTEM、Administrators，不能放到網站、原始碼 ZIP 或 Git。換發布電腦需安全移轉這把私鑰；不同簽章金鑰會被更新器拒絕。

模組驗證簽章、有效時間、版本、Minecraft／Forge、固定官方 HTTPS 下載網址，再檢查 JAR 長度、SHA256 和模組識別。更新清單最多 16 KiB、JAR 最多 16 MiB，不跟隨重新導向，不接受降版或遠端腳本。關閉後執行的 PowerShell 助手是模組隨附的固定本機程式，不是網站下載的腳本。

自動更新本身會在未來執行你簽署的新程式，因此簽章私鑰需備份及保護。自動更新器只更新 AI 小助手，不是整合包全體模組管理器。

驗收包括簽章、格式、來源、數值版本、雜湊拒絕、真實 Windows 替換／備份／回滾的隔離測試；真實 MultiMC 玩家從一版升級到下一版仍需驗收，不把隔離測試視為已完成真實遊戲更新。
