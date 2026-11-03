# 2026-11-04 儲存庫完整性與資安查核

沿用 `coyotewolf/minecraft-world-guide`，以遠端 `f5e2a24` 為基礎補齊 AOI 0.1.16 客戶端原始碼、測試與建置／發布工具。本機網站部分內容較舊，因此保留遠端 v10 攻略、知識庫、額度保護、Wrangler 4.151.3 與既有資安修補，不以本機舊檔覆蓋。

## 儲存範圍

- 保留網站前端、攻略、圖片、AI 知識庫、Cloudflare Worker、資料庫 SQL、Supabase 遷移、工具與 GitHub Actions。
- 補齊 `minecraft-client/` 的 91 個原始碼、測試、文件和建置檔案。
- 正式 JAR 與原始碼 ZIP 沿用既有 `downloads/`，不重複提交本機 82 個舊版發布檔案，也不提交 6 個現場測試／部署 JSON。
- 管理員啟用碼、`.env*`、`.dev.vars*`、部署快取、DPAPI 登入檔與私鑰格式由 `.gitignore` 排除。這些檔案不應作為備份上傳 GitHub。
- Gradle 8.8 發行 ZIP 增加官方 `distributionSha256Sum`，校驗值取自 [Gradle 官方發行校驗碼](https://downloads.gradle.org/distributions/gradle-8.8-bin.zip.sha256)。
- 本機原附 Wrapper JAR 的雜湊為 `ed2c26eba7cfb93cc2b7785d05e534f07b5b48b5e7fc941921cd098628abca58`，無法對應宣告的 Gradle 8.8 官方 Wrapper 校驗碼，因此換成 [Gradle v8.8.0 官方原始庫的 JAR](https://github.com/gradle/gradle/blob/v8.8.0/gradle/wrapper/gradle-wrapper.jar)。寫入前與[官方 Wrapper SHA-256](https://services.gradle.org/distributions/gradle-8.8-wrapper.jar.sha256)核對一致：`cb0da6751c2b753a16ac168bb354870ebb1e162e9083f116729cec9c781156b8`。這個不一致本身不代表原檔已被惡意修改。

## 已完成檢查

- 現有 repo 工作檔、完整可達 Git 歷史與下載壓縮檔遞迴憑證掃描：8,118 份去重內容、1,360,673,078 位元組，0 個命中。掃描含辨識式金鑰、私鑰、非 anon JWT 與部分明文憑證設定；不輸出憑證原值。
- 本機候選客戶端 179 個檔案（含最後排除的舊版封存）：憑證掃描 0 個命中。
- npm 官方漏洞資料庫：網站與 Worker 鎖定依賴均回報 0 個已知漏洞。
- Worker 測試 146 項、網站 `npm run check` 47 項、帳號／Edge／登入儲存／原生入口測試 31 項、密鑰掃描器測試 3 項全部通過。部分 Worker 測試與網站檢查重疊，不把合計當作獨立案例數。
- 既有 AOI 0.1.16 下載檔的 Ed25519 簽章、長度與 SHA-256 驗證通過；JAR SHA-256：`00d91f88df65b5c1765ee32a1e0db650352be397d817779812eb41664b451901`。
- `npm run build`、產生的 JavaScript 語法檢查與公開網站 allowlist 建置通過；公開輸出不含 Worker、資料庫、Git 設定或客戶端原始碼目錄。
- Supabase 正式專案安全 advisors 回傳空的 `lints`。專案清單同時顯示 `INACTIVE`，所以這項結果不能證明暫停中的正式資料庫已完成即時權限驗收。

## 查核邊界

此次完成程式／依賴／封存內容與測試檢查，沒有重新執行真實玩家登入、跨帳號資料庫測試、遊戲內 Forge 操作或 MultiMC 更新驗收，沒有啟動暫停中的 Supabase 專案。新增客戶端原始碼未在此次重新編譯或重新簽署發布；既有下載檔保持原值。辨識式掃描不能保證找出任意格式、任意編碼的秘密。

repo 中的 Supabase publishable key、服務 URL 和 Ed25519 驗證公鑰是公開用戶端設定；權限必須由後端身分驗證、有效 session 與 RLS 限制。正式玩家資料、服務權限金鑰及發布私鑰不包含在 repo 中。
