# 遊戲內助手部署與回滾

0.1.4 的 gameContextVersion 1 雲端支援已於 2026-10-10 發布，同一個原 AI Worker 使用程式內容更新 API；原綁定、秘密、設定和資料表保留。已核對上線位元組及支援版本。更新客戶端只需關閉遊戲、移除舊 JAR、放入 0.1.4，伺服器不需安裝。Windows 保存的登入維持同一路徑。

詳細更新／回滾版本、程式 SHA256 與檢查結果見 `SCENE-DEPLOYMENT.json`。舊模組不送快照仍可使用原問答；新模組會先查支援版本，雲端不支援時在呼叫模型前提示。Jar 回滾至 0.1.3 不必回滾雲端；若需要回滾雲端，使用紀錄中的先前版本，不删除玩家紀錄或重建知識庫。

0.1.3 加入 Windows 記住登入，只需替換客戶端 JAR。更新後先登入一次，之後重開遊戲會自動恢復。登出會移除 `config/aoi_assistant/session.dpapi`；沒有新 Worker 部署或資料庫遷移。回滾至 0.1.2 時可先登出清除保存的登入，舊版仍需每次重新登入。

0.1.2 準心提問只更新客戶端 JAR，沒有新雲端部署或資料庫遷移。關閉遊戲、備份並移除 0.1.1 JAR，再放入 0.1.2；伺服器不用安裝。下文的 Worker 部署紀錄為先前原生入口更新。

本次正式部署已完成：版本 `a250b178-b305-4813-82ee-652b56519c24`，時間 2026-10-09 18:25:51（UTC+8）。回滾版本為 `d9856ac0-c6f4-43e7-a9b5-b57f284794f8`。

實際部署先備份線上 bundle，只替換已測試的入口檢查，再使用 [Cloudflare Replace Worker Script Content API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/content/methods/update/) 更新程式。設定、秘密、資產與綁定保持原值，沒有重新上傳知識庫。線上 Java 與 CORS 檢查均通過；真實玩家驗收範圍見驗證報告。

## 發布前

1. 保存目前 Worker 原始碼與既有部署版本 ID。所有現有網站的登入、聊天、刪除與配額規則需維持正常。
2. 執行 `node --test cloud-ai/*.test.js`，以及 `minecraft-client/gradlew.bat verifyClient build`。核對 `release/SHA256SUMS.txt` 與 JAR。不得把 `src/verification` 或測試資料加入發布 JAR。
3. 在 Cloudflare 的測試環境先發布相同 Worker 的相容變更。保持現有 `GUIDE`、`ASSETS`、供應商與 Supabase 綁定；不要建立第二套正式知識庫／聊天資料表。測試環境不得使用正式玩家資料來做破壞性測試。
4. 用核可的測試帳號驗證無 Origin 的 `/status`、`/ask` 與 `/forget`。沒有 JWT、無效 JWT、停用帳號應被拒絕。網站 Origin 的請求與 preflight 應繼續正常。
5. 完成正式變更核准後，以現有維護流程發布 Worker 相容更新。再次驗證網站功能，再分發 JAR。

Worker 新增 `client-access.js`，只讓無 Origin 的 `POST /ask`、`POST /forget`、`GET /status` 進入既有 JWT / 核可玩家檢查。其他路徑與方法一律拒絕；瀏覽器來源仍只接受 `SITE_ORIGIN`，沒有新增 `*` CORS。原生請求不會取得網站 CORS 標頭。管理端點不對原生入口開放。

`NATIVE_CLIENT_ENABLED=false` 可停用原生請求，網站入口仍維持；未設為 false 時，相容程式支援原生入口。該變數不授予任何使用者權限，所有入口仍需核可的 JWT。

## 真實驗收

在實際 1.20.1 / Forge 47.4.23 整合包中，核對：主選單與按鍵入口、全螢幕／1280×720、繁中 IME、多行輸入、來源展開、滑鼠滾動、多人連線不要求伺服器安裝、網路故障可退出 UI。使用本人帳號在遊戲問 A、網站追問 B、遊戲追問 C；兩端手動刷新後應顯示同一 UUID 的紀錄與來源。

刪除使用可丟棄的測試對話。驗證雙向刪除、另一段對話刪除時保留目前草稿、重試不重複新增 UUID、已收到回答但上傳失敗只重傳。核對個人與全站免費用量共用。不要以測試替身的成功取代真實帳號驗收。

## 回滾

1. 只需停用原生入口時，部署 `NATIVE_CLIENT_ENABLED=false`，保留網站功能。需要完整回滾時，恢復先前已記錄的 Worker 部署版本。
2. 遊戲介面問題可移除目前版本的 `aoi-ai-assistant-1.20.1-0.1.3.jar`，或恢復備份的 0.1.2；不要同時啟用兩個版本。移除本機 config 僅重設服務網址及保存的登入，不會刪雲端聊天。
3. 不回滾 Supabase schema，也不刪除玩家帳號或正式聊天。此實作沒有資料庫遷移。
4. 觀測僅記錄錯誤碼、匿名 request ID、版本及延遲；不要記錄玩家問題、密碼、JWT 或 refresh token。
