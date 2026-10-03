# Minecraft鋼鐵與秘法：帝國紀元攻略

網站：https://coyotewolf.github.io/minecraft-world-guide/

手機優先的繁體中文像素冒險手札，整合四份完整攻略，按起步、定居、生產、旅行、戰鬥、探索、協作與收藏連接玩法。提供深色／淺色、減少動畫、全站搜尋、收藏圖鑑、成就條件、隊伍進度比較與即時需求板。

## 玩家使用

1. 攻略可直接閱讀。保存紀錄時以遊戲 ID 和網站專用密碼註冊，等待管理員核准。
2. 保存註冊時顯示的復原碼。密碼只供本網站使用，不是 Microsoft 或 Minecraft 密碼；遊戲 ID 不驗證遊戲帳號所有權。
3. 玩家使用一個世界的紀錄。完成狀態預設分享給同隊，可於「我的」關閉；私人筆記與細部條件不分享。
4. 隊長建立隊伍、產生邀請碼，隊友輸入邀請碼加入。隊伍內可共享據點、計畫、里程碑與逐項收藏比較。
5. 需求與任務邀約只對同隊可見。接單者提交後，由發布者確認完成。網站開啟且連線時收到站內即時通知。
6. 忘記密碼可用復原碼；管理員可使舊登入失效並產生新復原碼，私下交還經確認身分的玩家。

## 首次管理員

擁有者本機另有「首次管理員啟用碼.txt」，沒有上傳 GitHub。首次註冊時展開「我是首次管理員」，輸入檔案中的啟用碼。成功後此碼失效，該帳號直接啟用並可審批玩家。請另外保存自己註冊所得的帳號復原碼。

## 可修改的網站名稱

編輯 `site-config.json` 的網站名稱、伺服器中英文名稱、標語與敘述，提交後 GitHub Pages 自動重新發布。Supabase publishable key 是允許公開的用戶端金鑰；伺服器權限金鑰、啟用碼、玩家密碼與復原碼不得放進公開儲存庫。

## 攻略資料與查核範圍

2026-10-04 唯讀盤點本機 253 個模組 JAR、原版 1.20.1 資源、配方、語系、按鍵及本機資料包候選。四份原攻略保留圖像與操作內容，圖片以原始位元組抽出、按雜湊共用，不分發模組 JAR。

共有 47 篇玩家教學、1,946 個可計進度收藏、1,108 個帶顯示的成就（含隱藏）。64 個其他圖鑑條目不計收藏完成率。8,195 個無顯示的內部進度另存於資料，不計成就完成率。網站翻譯缺漏的成就保留原文字及來源資訊。

這不是伺服器啟用清單或遊戲內逐項驗收。伺服器檔案無法取得，生成、配方、倍率、啟用条件、自訂程式觸發與新增成就可能不同。檔案重複資源的選取結果與語系解析問題保留於 `data/summary.json`。完整稽核在「交付與驗收.md」。原攻略文字／素材的權利屬於其原作者與對應遊戲／模組作者；本網站非 Minecraft 官方網站。

## 維護

前端是靜態網站，由 GitHub Pages 發布；玩家資料保存在 Supabase Free 專案。資料表有行級權限、欄位權限及有效登入检查，隊伍比較不返回筆記或条件。帳號登入／註冊／復原透過已部署的 `player-auth`，管理權限只在伺服器驗證。SQL 遷移按 `schema.sql`、`approval.sql`、`hardening.sql`、`policy-performance.sql` 順序套用；已建好的專案不需要重跑。

本機建置：`npm ci`、`npm run check`、`npm run build`。網站入口載入 `assets/app.min.js`。更新攻略來源時可依序執行 `tools/scan_pack.py`、`tools/build_content.py`、`tools/localize_content.py`、`tools/finalize_content.py`、`tools/prepare_guides.py`、`tools/theme_guides.py`；Python 的 BeautifulSoup 與 OpenCC 需先準備。盤點程式的本機路徑可修改，原攻略由 Downloads 讀取。

免費方案有容量與用量上限；Supabase 低活動的免費專案可能在七天後暫停，可由擁有者於控制台恢復。沒有訂閱付費方案，也沒有以定時請求規避閒置規則。參考 [Supabase 免費方案](https://supabase.com/pricing)、[專案暫停說明](https://supabase.com/docs/guides/platform/free-project-pausing)、[GitHub Pages 使用限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。
