import json,pathlib
P=pathlib.Path(__file__).resolve().parents[1];D=P/'data'
R=json.loads((D/'recipes.json').read_text(encoding='utf8'));L=json.loads((D/'languages.json').read_text(encoding='utf8'))
A=[]
def add(id,group,title,intro,items,steps,fix,links,mods,sources=[]):
 A.append(dict(id=id,group=group,title=title,intro=intro,items=items.split('|') if items else [],steps=steps.split('|'),troubleshooting=fix.split('|'),related=links.split(),mods=mods.split(),sources=sources))
add('start','起步','把原版經驗帶進這個世界','你已經會活下來，現在要學的是：如何查新物品、看懂地圖、避免在新戰鬥模式下誤操作。','',
 '先打開背包，用右側物品清單搜尋中文名稱；滑鼠指向物品後查看配方與用途。若快捷鍵不生效，到控制設定搜尋「配方」與「用途」，不要假設每位玩家都是同一按鍵。|拿不準方塊功能時，把準星指向它，查看畫面上的方塊資訊；工作站是否有動力、容器剩餘空間，通常比猜測更有用。|在安全地方試切換戰鬥模式，再檢查閃避、技能介面、連鎖採集與地圖按鍵；本機未綁定的功能先自行指定不衝突的按鍵。|先建立基地、地牢入口與回程路線的地圖標記，再安排探索；網站的「我的紀錄」可保存下一步要做的事。',
 '同名物品的配方不同：配方頁可能有多種來源，切換頁籤；有配方衝突時使用合成結果切換功能。|網站紀錄不會自動改動遊戲進度，成就仍需在遊戲中實際觸發。','controls map backpack combat party','jei jade jadeaddons polymorph')
add('controls','起步','先把操作調順手','所有操作依目前客戶端按鍵盤點；其他玩家與伺服器不會自動採用這份設定。','',
 '進入「選項 → 控制 → 按鍵綁定」，依功能名稱搜尋；紅色衝突鍵先重新配置。|本機戰鬥模式切換為 `，閃避為左 Alt，格擋為滑鼠右鍵。技能介面與鎖定目前未綁定，先設定後再練習。|本機法術輪盤為 Y、法書施法為 U；背包快捷開啟為數字 0、語音選單為 =。|本機跑酷蹲爬為 C、快速奔跑為左 Ctrl；部分攀附、翻越與受身共用右鍵，先在無怪區練習。|連鎖採集目前未綁定；搜尋 FTB Ultimine 並設定按鍵。大型連鎖操作前先確認範圍與保護區。',
 '技能按了無反應：確認戰鬥模式、主手武器與技能欄要求，再看是否未綁定。|右鍵同時触發跑酷與格擋：依自己的玩法調整衝突，網站只展示盤點值。','start combat magic mobility','epicfight parcool irons_spellbooks sophisticatedbackpacks voicechat ftbultimine')
add('map','起步','地圖、路標與不迷路的遠征','把世界記成可回訪的路線，而不是一堆失去脈絡的座標。','',
 '先在控制設定指定小地圖、世界地圖與新增路標按鍵。|標記基地、殖民地、地牢入口、海岸港口與危險區；名稱寫用途，例如「北方石灰岩採集點」。|每筆共享據點記下維度、XYZ、入口方向與交通方式。跨維度不能只記一組數字。|組隊遠征先約定集合點、撤退點與死亡回收路線；把行程發在隊伍邀約中。',
 '隊友看不到你的標記：地圖標記、遊戲隊伍與網站隊伍是不同系統，需各自分享或加入。|網站不提供瞬移，也不會知道你在遊戲中的即時座標。','party rescue trains ships','xaerominimap xaeroworldmap better_party')
add('backpack','起步','讓背包裝得下遠征','把工具、戰利品、食物和回收空間分開，回家後再接到基地倉儲。','sophisticatedbackpacks:backpack|toolbelt:belt',
 '用配方查詢製作背包；先打開背包確認實際容量，再依配方升級。|安裝升級時檢查該升級的設定與過濾規則，尤其是拾取、壓縮與補給，避免把任務材料自動轉換。|常用工具放工具腰帶或固定格位；本機背包開啟為數字 0，腰帶按鍵依自己的控制設定指定。|出發前留空位給掉落物，珍貴收藏先回基地存放；背包收藏頁與裝備收藏頁可一起記錄。',
 '物品莫名消失或變形：先檢查升級過濾器、壓縮規則與自動餵入容器。|背包放進其他容器或飾品欄後開不了：確認背包所在位置與該功能的伺服器設定。','storage rescue expedition','sophisticatedbackpacks toolbelt curios')
add('party','協作','把遊戲隊伍與網站隊伍配合使用','網站負責記錄與約人；遊戲內隊伍、領地與語音仍要在遊戲中設定。','',
 '網站註冊遊戲 ID，設定網站專用密碼並保存復原碼；等待管理員核准後登入。|一人建立網站隊伍，由隊長產生邀請碼；隊友輸入邀請碼加入。邀請碼有效七天，請只分享給隊友。|遊戲內另行建立 FTB 隊伍與組隊功能，確認領地權限；網站加入隊伍不會授予遊戲內開箱或建造權限。|在遊戲語音選單 = 設定麥克風與按住說話鍵；若伺服器未提供語音服務，客戶端安裝不能保證可用。|隊伍頁可比較各人的裝備、技能、首領、夥伴與成就完成率；個人設定可關閉進度分享，私人筆記不會出現在比較頁。',
 '網站沒有讀取你的遊戲帳號，名字不是身分驗證。|聽不到隊友：先確認伺服器語音可用、麥克風權限與輸入裝置。','requests land map','ftbteams ftbchunks better_party voicechat')
add('requests','協作','發物品需求，或約隊友一起出發','把「誰有材料？」與「要不要打王？」變成能追蹤的隊伍工作。','',
 '加入隊伍後，在需求板選「物品申請」或「任務邀約」，填名稱、数量、用途、交付地點與時間。|材料名稱寫清楚品種、附魔或特殊屬性；大批建築材料可附上工地用途，讓隊友知道優先順序。|其他隊員可接單與留言；網頁開著時會收到站內即時提醒。|接單者完成交付後按「提交完成」，由發布者確認；有問題可退回，發布者也可取消。|重要遠征留言列出裝備、召喚物、集合點、撤退條件與掉落分配；確認完成前仍保留討論紀錄。',
 '接單失敗：可能有人同時先接走，重新整理確認狀態。|關掉瀏覽器後不會收到推播；重新開啟可查所有需求與留言。','party expedition colony-materials','')
add('rescue','起步','倒地救援、死亡回收與撤退','把失敗成本控制住，才適合在陌生地牢試新裝備。','',
 '出發前記錄集合點與裝備，帶備用食物、照明和一套回收裝備。|若出現倒地狀態，先觀察倒數與互動提示，隊友清理附近威脅後依提示救援；實際救援時間以伺服器設定為準。|死亡後用地圖死亡點返回；若出現屍體容器，依互動提示取回物品。遇到領地限制先請領地主人開放。|不要讓全隊同時衝回屍體，安排一人引怪、一人回收、一人留在安全點。|回收後在首領頁記下失敗原因，再補裝備、移動或抗性，不把連續送裝當練習。',
 '沒有屍體或倒地機制：伺服器可能未裝、已關閉或改規則。|魔法救援卷軸與玩家倒地救援不一定是同一機制；先查該物品用途。','combat expedition party','corpse playerrevive')
add('land','定居','選基地，留出帝國擴張的空間','住家、殖民地和工廠都需要空間，先安排路網比拆掉重蓋便宜。','',
 '先看大片地形、木材、水源與交通，留出工廠、住區、港口、農場與殖民地建築升級空間。|遊戲內開啟區塊領地介面，確認能否宣告領地及隊伍共用權限；領地數量與強制載入配額依伺服器為準。|殖民地自己的保護範圍與 FTB 領地分開管理，兩者都可能擋住隊友、搬運或機械。|把主要道路、工廠隔離區與首領召喚試驗場記在隊伍據點；重型機械與爆炸測試遠離住宅。',
 '自動化只在靠近時運作：區塊沒載入或設備跨出載入範圍。|不可建造或取物：同時檢查兩種領地保護與隊伍權限。','colony-start factory storage','ftbchunks ftbteams minecolonies')
add('colony-start','定居','殖民地第一步：從工地變成聚落','先讓建築工能完成自己的工作，再談人口與產業擴张。','minecolonies:supplycampdeployer|minecolonies:buildtool|minecolonies:blockhuttownhall|minecolonies:blockhutbuilder',
 '準備木材、石材、鐵、煤、羊毛、食物與工具；用配方頁製作補給營地或直接製作市政廳與建築工具。|找平坦且能擴張的地點。補給營地直接對地面使用；無法放下時清空植物、凹洞與障礙。|取得市政廳方塊與建築工具，用建築工具選風格、位置與方向，先看完整預覽與升級占地，再確認。|對市政廳操作，依介面建立殖民地。市政廳的位置影响中心與保護範圍，不要只因有空位就隨便放。|用建築工具安排建築工小屋，打開小屋方塊的建造選項下達建造工作，確保有居民被指派為建築工。',
 '放了小屋方塊卻沒建築：還沒下達建造工作。|找不到居民：先確認已建立殖民地、區域載入及人口資訊。','colony-builder colony-materials colony-life','minecolonies structurize', ['https://minecolonies.com/wiki/tutorials/getting-started/'])
add('colony-builder','定居','讓建築工完成第一棟建築','建築工不開工，通常是缺材料、工具、指派或可走的路。','minecolonies:blockhutbuilder',
 '打開建築工小屋，確認建築工人員指派與目前工單，優先完成建築工自己的小屋。|查看所需資源清單，按需求提供正確方塊、工具與食物；物品外觀相同也可能不是要求的材質。|材料放進小屋儲物或依介面需求交付，不要以為旁邊的普通箱子會自動被工人使用。|清出通往工地的路，避免閉鎖門、落差、圍牆與其他領地擋路。|想建造更高級建築時，先檢查建築工小屋等級與工人能力；不要同時排大量超出能力的工單。',
 '建築工站著不動：看居民當下需求，再看工單、材料、工具耐久、工作時間與路徑。|升級後缺奇怪裝飾：轉到「裝飾材料」教學，照需求材質製作。','colony-materials colony-logistics decor','minecolonies structurize',['https://minecolonies.com/wiki/buildings/builder/'])
add('colony-materials','定居','工地缺料：把採集、加工與需求接起來','把完整建造清單拆成可交付批次，別讓工人一直等最後幾個裝飾塊。','domum_ornamentum:architectscutter',
 '先讀本次建築的資源清單，分成原料、普通加工品與指定材質裝飾。|木材與石材先用基地產線備料；裝飾塊在建築切割器依需求選基材和副材。|遇到名稱組合相似的方塊，核對需求圖示、材質與形狀，不要只靠名稱下半段猜。|在網站發布缺料申請，註明工地與用途；隊友可採集，你負責最後的加工與驗收。|建立倉庫和送貨員後，再把日常需求交給殖民地物流；外部工廠供應需以容器與允許的搬運方式實測銜接。',
 '建築工不接受材料：檢查材質、顏色、形狀、NBT 與需求數量。|工廠與殖民地不會因同時安裝而自動相通。','factory colony-logistics decor requests','minecolonies domum_ornamentum create')
add('colony-life','定居','居民、食物、住宅與幸福度','聚落能穩定供應生活需求，人口增加才是好事。','minecolonies:blockhutcitizen|minecolonies:blockhutrestaurant|minecolonies:blockhutfarmer|minecolonies:blockhutguardtower',
 '建住宅并查看床位與入住狀態；人口增加前先準備住處與食物。|打開居民資訊，讀目前需求與幸福度原因；逐項解決缺食物、住處、工具或安全問題。|安排農場與餐廳，先確認菜單、原料與居民可接受的食物，別假設所有模組料理都被自動辨識。|白天完成採集與建造，夜間保留可回家路線與照明；建立守衛塔並提供合適装备。|人口、職業與士兵成就可在成就頁查看；只有達成遊戲條件才會解鎖。',
 '居民不工作：先看需求，不只看幸福度总数。|食物放普通箱子無效：確認工人、餐廳与配送系統實際取得的位置。','food colony-logistics colony-research','minecolonies farmersdelight kaleidoscope_cookery')
add('colony-logistics','定居','倉庫、送貨員與自動補給','一個總倉庫加上能走通的配送路，讓你從跑腿轉向管理。','minecolonies:blockhutwarehouse|minecolonies:blockhutdeliveryman',
 '建造倉庫並指派需要的管理工作，先確認已完成建筑，而不是只有方塊。|建造送貨員小屋并指派居民，讓他們能到达倉庫與各工作小屋。|把常用木材、石材、工具與食物放入殖民地可用的倉储，查看需求是否进入配送流程。|用小批材料測試配送，觀察倉庫、送貨員與工地三處庫存；穩定後再增加工廠供應。|外部抽屜、數位倉儲與殖民地倉庫各有管理方式，先確認庫存與補給責任，避免同一份材料被不同系統反覆抽走。',
 '材料明明在倉庫仍缺料：看送貨員、路徑、需求狀態與庫存是否被其他產線占用。|過度集中大量貨物可能造成配送延遲；升級與增設人員前先查瓶頸。','storage factory colony-materials','minecolonies create ae2',['https://minecolonies.com/wiki/buildings/warehouse/'])
add('colony-research','定居','研究、產業與守衛的成長','以正在遇到的瓶頸決定研究與建築，不必照模組清單逐棟蓋。','minecolonies:blockhutuniversity|minecolonies:blockhutbarracks',
 '建大學並打開研究介面，先看每個研究的建筑等级、资源與前置要求。|優先選能解決當前工地、配送、人口或防衛問題的研究，準備材料後启动。|研究解鎖不等於建筑已建好；回到對應工地安排建造或升級。|守衛先確保裝備、工作指派與巡邏路線，再扩張住宅与外围生产。|遇到襲擊記錄敌人、进入方向與损失，調整防線；襲擊强度與人口上限是伺服器規則。',
 '研究不能點：核對前置研究與所需建築是否真的达到等級。|攻城或戰鬥相容內容不代表所有首領都会自然攻击殖民地。','colony-life colony-builder combat','minecolonies epiccolonies',['https://minecolonies.com/wiki/buildings/university/'])
add('decor','定居','從工地材料到自己的建築風格','同一套加工區可以供應殖民地、住家與工廠裝飾。','domum_ornamentum:architectscutter|framedblocks:framed_cube|create:schematicannon',
 '先用建築切割器選形狀與兩種指定材質，製作工地要求的裝飾。|自由建築可使用框架或複製材質方塊；先在小範圍測試外觀、碰撞與照明。|使用輔助建築模式前確認選取範圍、材料數量與領地权限，避免整面牆误填。|大型建築可先做藍圖，再用藍圖炮依實際所需材料施工；存下蓝图名称與材料清單便於隊友協作。',
 '預覽與放下不同：檢查旋轉、鏡像、材質和伺服器允許的操作。|藍圖炮停工：看材料、燃料、範圍與缺块，而不是反覆重启。','colony-materials blueprints','domum_ornamentum framedblocks copycats effortlessbuilding supplementaries createdeco')
add('food','生產','從吃飽到遠征補給','農場的成果要變成能帶出門、能供應居民的食物。','farmersdelight:cutting_board|farmersdelight:cooking_pot|kaleidoscope_cookery:pot',
 '先建立穩定的作物與牲畜來源，保留種子與繁殖用食物，不把全部原料一次煮完。|切菜板、刀具、鍋具與熱源各有工作条件；按配方頁确认材料、烹飪時間與容器。|料理先小量做並試吃，查看实际效果與持续时间，再决定遠征菜單；不是每個增益都可疊加。|將可保存的成品集中到補給箱，為殖民地与遠征分开預留。|需要肉類加工時，依工作站與刀具配方操作；把副產物和食材分流，避免堵住產線。',
 '鍋不運作：先檢查熱源、食材配方與成品容器。|居民不吃某料理：以殖民地接受的食物與設定為準。','colony-life factory expedition','farmersdelight kaleidoscope_cookery butchercraft')
add('factory','生產','第一條工廠：把原料送到成品','從一個清楚的加工目標開始，先讓一條线穩定，再擴成帝國。','create:andesite_alloy|create:water_wheel|create:shaft|create:cogwheel|create:mechanical_press|create:depot',
 '在配方查詢選一个实际目标，例如把金属錠壓成板，確認需要的機器與輸入。|做水輪與傳動軸，接到機械壓製機；確認水輪有转动、转向與整段动力連續。|將置物台放在工作點，先手動放一件原料測試；看机器動作與產物是否正確。|用傳送帶、漏斗與容器接輸入輸出；先限制單一原料，留下成品出口。|加入更多機器前戴工程師護目鏡查看應力與速度，將動力問題與材料問題分开處理。',
 '機器停止或過載：減少負載、增加動力或降低速度。|原料跑過去沒加工：看工作點高度、機器类型與實際配方。','factory-fan factory-brass storage','create')
add('factory-fan','生產','洗礦、熔煉與風扇加工','一座加工站能處理多種原料，但介質、風向與停留時間必須對。','create:encased_fan|create:depot',
 '先在配方頁確認目标是清洗、熔炼、煙燻还是其他风扇加工，不凭材料名稱猜。|接上風扇動力，讓氣流穿過配方需要的水、熔岩、火源或其他介質。|先把單件原料放置物台，確認氣流方向、距離與加工完成；不要一開始就高速傳送帶。|加工稳定後才增加輸送與過濾，将不能加工的物品另外导出。',
 '等很久仍不變：確認配方頁真的列有此加工類型、氣流接觸材料，以及停留時間。|高速傳送带导致物品还没完成就離開，先延長等待區。','factory factory-brass ore','create')
add('factory-brass','生產','黃銅與精密加工：讓工廠進階','下一阶段的機器常需要合金、受熱攪拌与有順序的組裝。','create:mechanical_mixer|create:basin|create:blaze_burner|create:brass_ingot|create:precision_mechanism',
 '查黄铜配方，準備配方指定金屬與攪拌盆；需要受熱时在盆下放正确热源。|火焰燃烧室需要其自己的取得步骤與燃料，先确认热度再投入原料。|精密構件等序列组装配方要依页面顺序经过机器，并注意重复次数与失败產物。|先把整個序列手動走通，再設傳送带循环，避免半成品流入錯誤出口。',
 '攪拌器沒動：檢查转速、热度与材料組合。|成品概率或重複次數以本機配方頁为准；伺服器可能覆盖。','factory power guns','create create_connected createaddition')
add('power','生產','旋轉動力、電力與燃料','這個世界有不同的能源系統，接线前先分清機器吃的是哪一種。','createaddition:alternator|createaddition:electric_motor',
 '先看機器配方與介面，區分机械转动、電力與燃料；轴不能直接给数位倉储供电。|使用發電机或转换设备时，先做小型测试：输入、输出、储能与负载各放一台。|本包有柴油、電力與機械動力扩充，按实际配方确认设备支援的流体与连接方式。|记录能耗、补给与停机原因，为关键仓储留下备用供电；全廠断电时先恢复仓储和補給。',
 '有線卻沒電：看输入输出面、能量类型、線路與缓冲是否足够。|不能假设不同扩充的燃料可以互换。','factory storage-digital ore','createaddition create_new_age createdieselgenerators botarium')
add('ore','生產','把礦物供應變成長期產業','連鎖採集解决手工效率，矿脉开采与加工解决长期供應。','',
 '先指定連鎖採集按鍵，使用前看选取范围与工具耐久；避免把基地结构一起选入。|手工矿物回家后做统一分流，接清洗、熔炼或冶金配方，保留稀有矿物供下一阶段机器。|礦脈或流体开采设备先按其工具与界面定位资源，再检查地點、动力、钻头与輸出容器。|大规模冶金按实际熔融、合金和冷却配方配置，不把其他包的配方抄進来。',
 '开采机空转：确认所在矿脉、设备配件、区块載入與动力。|連鎖採集未綁定不代表模組沒装。','factory-fan power storage','ftbultimine createultimine createoreexcavation createmetallurgy industrial_platform vintage')
add('storage','生產','從箱子堆到統一倉儲','先把大宗原料與收藏分開，再決定是否上數位系統。','functionalstorage:oak_1|create:item_vault|enderstorage:ender_storage',
 '大宗木石与加工原料用抽屉，贵重收藏与NBT物品分开容器。|给容器设清楚的输入输出与容量，必要时锁定品项，避免产线改送新物品占掉位置。|远程或跨区搬运先检查颜色、频率与所有权设置，测试小量物品再接主仓库。|若想一处搜索全部物品，接着做數位倉儲；殖民地仓库仍需由其配送系统处理工单。',
 '物品不见：先查频率与共享設定、輸出目的地及垃圾處理。|满仓会让上游停工，产线需要明确的满载处理。','storage-digital colony-logistics factory','functionalstorage enderstorage create_compatible_storage')
add('storage-digital','生產','第一個數位倉庫：電力、線路與終端','先完成能存取物品的小网络，再谈全自动合成。','ae2:charger|ae2:energy_acceptor|ae2:drive|ae2:terminal|ae2:fluix_glass_cable',
 '查石英、充能水晶与福鲁伊克斯材料的取得方法，先做充能器；配方不熟時打开遊戲內指南。|准备供电与能量接收设备，连到驱动器與終端；装入适用储存元件，再放一件物品测试。|线缆必须形成连接，终端、驱动与外部容器各可能占用通道；故障时先看電力再看通道。|使用储存总线对接外部容器前确认权限、優先级与允许存入的种类。|无线终端先依本包版本的绑定、充电与范围规则设置；不能当成无限距离无条件访问。',
 '有電但設備離線：檢查通道與線路分配。|容量还有但放不进：儲存元件可能有种类限制、格式化或优先级问题。','storage-crafting power storage','ae2 ae2wtlib megacells extendedae ae2omnicells')
add('storage-crafting','生產','讓工廠與倉庫接單製作','先學會教配方，再把加工任务交给真正的机器。','ae2:pattern_encoding_terminal|ae2:pattern_provider|ae2:molecular_assembler|ae2:crafting_unit',
 '先做合成处理所需CPU与配方设备，用普通合成配方验证一次完整下单。|合成配方與加工配方分开：加工配方要写明输入输出，并把配方供應器指向正确机器或缓冲。|機器输出必须返回网络；多输出、容器與副產物都需按实际配方处理。|先用单笔订单测试，再开并行任务；重复送入原料或卡料时检查阻塞模式與输入缓冲。|连接机械工厂的扩充設備先看它支持的机器与格式，不因装了多个桥接模组就假设可混用。',
 '下单显示缺料：检查配方是否编码、可执行、CPU空闲与中间材料。|任务一直等待：通常是机器输出未回網路或配方输出不匹配。','factory-brass storage-digital logistics','ae2 createappliedkinetics appliedcreate createstockbridge extendedae')
add('logistics','生產','把村鎮與工廠接成供應網','統一目的地、品項與補給責任，比增加运输机器更重要。','create:brass_funnel|create:brass_tunnel',
 '画出原料仓、加工站、成品仓、殖民地与港口的物流路线，先确认每条线的输入输出。|用过滤器限制品项，给关键物品预留库存，不让建筑材料与战斗补给互相抢光。|工厂订单、数位合成与殖民地工单各有自己的状态；用网站需求说明责任人和交付位置。|跨区运输前确认区块载入与缓冲，先以少量材料跑一次完整路线。',
 '物品在两端来回跑：过滤与优先级不清。|服务器载入配额未知，网站不会替你强制載入区块。','storage-crafting trains colony-logistics','create createadditionallogistics createstockbridge create_power_loader')
add('blueprints','定居','藍圖施工與多人建設','把设计变成可重复施工的项目，避免队友各蓋各的接不上。','create:schematic_and_quill|create:schematicannon',
 '使用蓝图与羽毛笔框选保存建筑，记下范围与方向；先在安全地点测试预览。|给施工位置预留地基，检查旋转、镜像与领地权限，再部署。|给蓝图炮提供配方要求的燃料与完整材料清单，先观察小段施工。|特殊方块、容器内容、实体与某些模组资料不一定能复制；完工后逐一检查机器连线与功能。|网站建设邀约写材料清单、入口、工期與负责范围，避免多人同时改同一块。',
 '复制外观不等于机器已经配置好。|升级炮或建筑辅助的具体行为要以本包设置为准。','decor factory requests','create create_enhanced_schematicannon create_pattern_schematics structurize')
add('trains','旅行','把基地、矿区與殖民地連成鐵路','先做一条可靠往返线，再扩成客运与貨运帝国。','create:track|create:train_station|create:train_controls|create:schedule',
 '铺轨连接两个目的地，预留转弯與列车长度，并在站点摆火车站。|在车站进入组装流程，按界面放轉向架与车体，放控制台并组装列车；先手動短程试车。|设置排程时核对站名，安排等待条件與回程，避免一趟到站就停死。|多车共线时加信号与安全分段；貨物装卸先确认停靠位置、接口与缓冲。|旅客导航只辅助规划，列车是否能到站仍取决于实际线路与排程。',
 '不能组装：看车体连接、转向架與控制台。|火车停住：查看信号、站名、缺失轨道与區塊載入。','logistics land ships','create railways createrailwaysnavigator')
add('ships','旅行','港口、船舶與會移动的建筑','会动的载具与普通建筑不同，先小型试航再装重要机器。','vs_eureka:ship_helm',
 '先按配方制作船舵，建小型船体并留出完整水面与周围空间。|用船舵界面进行组装或航行操作，依提示确认连成船体的方块范围。|首次只装轻量设施，测试转向、浮力、停靠與拆卸；再决定要不要扩建。|移动船体上的机器、传送、领地与储存连接有相容限制，逐项测试，别把全部收藏装上首航。|气球、机械驱动與履带属于不同载具路线，按各自工作站及游戏指南操作，不照普通船舶规则猜。',
 '组装范围带走码头：船体与陆地未隔开。|载具卡住或抖动：先减少复杂结构，再确认伺服器支持的版本与规则。','trains flight mobility','valkyrienskies vs_eureka clockwork trackwork vss')
add('mobility','旅行','跑酷、鉤爪與安全移動','移動能力能帮助你探索，也可能把你送进更危险的地方。','',
 '在无怪的平地练习奔跑、翻越、蹲爬、攀附与受身；先确认体力与键位提示。|本机C蹲爬、左Ctrl快速奔跑、右键用于部分动作，和格挡冲突时重新绑定。|制作钩爪后按物品提示练习发射、收回与摆荡，先在低处确认距离和落地伤害。|地牢中保留能步行的撤退路线；不要把所有队友都帶上只靠钩爪才能回来的高处。',
 '动作不触发：看姿态、体力、可附着表面与控制设置。|跑酷不能保证免疫摔落或避开首領范围攻击。','controls expedition flight','parcool grappling_hook_mod')
add('flight','旅行','飛行装备與遠程探索','取得飞行能力以后，燃料、修理与降落点才是新的生存问题。','create_jetpack:jetpack',
 '在裝備圖鑑搜尋喷射背包、飞行或移动装备，查看本包配方与燃料。|制作后先确认装备栏位、启用方式與能量／流体，短程低空测试。|起飞前准备备用补给与降落点，记录返程成本，别等资源用完才找陆地。|需要机械飛行或宇宙探索时，先完成前置产线與防护；不要把外观像飞行装备就当成完整航行系统。',
 '能穿却飞不起来：检查姿态、开关、燃料、权限与控制。|领地、限高或服务器性能规则可能限制使用。','ships power space','create_jetpack create_sa balancedflight')
add('space','旅行','更遠的疆域：準備太空探索','当地面的工厂与物流稳定后，再把燃料、防护与返航能力带向新环境。','',
 '本包安装了 Northstar。先在配方清单与游戏内指南搜尋它的工作站、推进與宇航装备。|按本机配方準備前置材料、能源和燃料；先把必要生產线接到基地。|出发前确认完整防护、环境需求、着陆与返航方案，保留第二套补给。|目前没有服务器维度與配置资料，新的目的地是否启用以实际游戏为准；網站不编造解锁顺序。',
 '如果游戏内没有对应配方或目的地，先确认服务器是否安装／启用相同内容。','power flight logistics','northstar')
add('combat','戰鬥','先選战斗方式，再選裝備','近战、枪械与魔法可协同，但每一种都要求正确的持握、模式與補給。','',
 '先在安全区切换战斗模式，确认主手武器的动作、格挡、闪避与耐力。|练习一次普通攻击后撤、一次格挡与一次闪避，掌握后摇，避免把连按当成连招。|打开技能收藏，查看对应武器、技能书或技能树的取得条件；不是所有技能都能独立收集。|法术与枪械可填补距离和控制，但仍须处理法力、弹药与施放动作。|用训练假人比較实际伤害与攻速，再帶进低风险遭遇，记下自己能稳定完成的操作。',
 '装备伤害高但打不中：先看动作覆盖、站位与后摇。|舊攻略快捷键可能不同；本网站的操作页列新实例盘点值。','skills magic guns equipment-training scarlet','epicfight wom epicfight_awaken dummmmmmy')
add('skills','戰鬥','技能、法術與成長收集','把技能的取得方式和使用条件一起记下来，收藏才会变成战斗能力。','',
 '在收藏页选「技能与法术」，区分技能书、武器内建技能與技能树功能。|技能书依掉落、宝箱或其他取得方式收集；武器内建技能先取得真正的武器，再按持握条件使用。|需要技能树的功能依其升级介面解锁；参考項不计入收藏完成率。|看每项攻略的主手、副手、模式、前置技能与按键，再安排到自己的配置。|做不同武器的练习记录，只有实际取得并能使用才勾选完成。',
 '背包里没技能书不代表没有技能：它可能绑定在武器或技能树上。|附魔、装备能力和独立技能是不同系统。','combat equipment-training magic','epicfight wom efn improvableskills gokiskills')
add('magic','戰鬥','从第一本法書到完整施法配置','法书栏位、卷轴與施法资源要一起准备。','irons_spellbooks:scroll_forge|irons_spellbooks:arcane_anvil',
 '查看法术收藏的取得来源，先准备法书與合适卷轴；不要假设每种法术都直接合成。|用相应工作站把卷轴写入法书，确认法书的栏位、容量与卷轴条件。|本机Y开法术轮盘，U使用法书施法；装备法书后选中法术，在安全区确认射程、前摇与法力消耗。|將输出、治疗、净化、控制与移动分配到不同用途，出发前确认可用资源。|法术升级与专精依卷轴、工作站和本机配方；留出施法被打断时的撤退方法。',
 '轮盘有法术但施放失败：看法书栏位、法力、冷却与装备条件。|召唤和复活法术不是通用的跨系统救援按钮。','skills combat expedition','irons_spellbooks efiscompat tetra_spell_book')
add('guns','戰鬥','槍械、彈藥與工廠補給','枪械战斗的门槛不是只有一把枪，还包括兼容弹药与维修供应。','',
 '在物品清单查看枪械工作台、枪和弹药配方；枪包中的枪械不一定使用普通物品配方。|确认枪的型号、弹种与附件要求，先用同一枪在安全区做装弹、瞄准与射击练习。|查看控制设置中的换弹、检查、模式与附件键，再与战斗模式兼容功能一起测试。|把金属加工、弹药材料和成品缓冲连成小產線，先生产一批验证可以裝填。|远征带备用弹药，并留近战或魔法作为补给中断时的选择。',
 '弹药图示相像却不能裝：核对弹种标识与枪包规则。|枪械伤害與兼容行为以服务器实际配置为准。','factory-brass combat artillery','tacz tacz_tweaks createimmersivetacz epictaczcompat')
add('equipment-training','戰鬥','裝備配方、強化與實測','用收藏圖鑑追材料，用训练区确认它真的适合你。','tetra:workbench|minecraft:anvil',
 '在装备收藏选目标，展开材料与来源；需要多阶段加工时先建立对应工作站。|模块化工具在对应工作台選模块、材料與改良，检查工具等级和操作要求；不是普通合成台换材料就完成。|强化、附魔与去附魔各有成本與相容规则，先用备用装备测试，避免不可逆覆盖稀有属性。|外观盔甲與实际防具分开，飾品依指定槽位装备；看起来穿着不等于提供属性。|用训练假人测试自己的整套配置，記下持握、技能与增益，再决定正式投入。',
 '同一种材料能否装入不同模組工具，必须看实际工作台支持。|装备圖鑑找不到生存来源的内容不会假装已可收集。','combat factory-brass organs','tetra tetracelium toollevelingrework curios cosmeticarmorreworked')
add('organs','戰鬥','身体改造：先理解代价再动手','身体改造是独立路线，不能靠装備數值推测其结果。','',
 '本包有 Chest Cavity。先在物品清单查其工具、器官與遊戲內说明，準备撤回或恢复所需物品。|在安全环境用备用资源测试其开启与装入规则，读器官属性与身体需求。|更换后查看生命、代谢、呼吸或其他指标是否稳定；出现负面效果先停止继续改造。|将成功的配置与恢复步骤记在私人笔记，不把未经验证的组合推荐给全队。',
 '這类操作可能改变生存条件；网站不会把缺少来源证据的器官组合当成通用最强配装。','equipment-training combat food','chestcavity')
add('expedition','探索','第一次地牢遠征：带着目的出发','先决定是找材料、收藏还是挑战，不必每次都打到最后一层。','',
 '选目标后查看收藏与成就前置，准备钥匙、召唤材料或需要的移动能力。|带照明、建筑方块、食物、备用武器與回收裝備，在入口留下地图标记。|先觀察怪物与地形，再分房推进；稀有建筑可能有机关、守卫與特殊生成条件。|把重要战利品分批送回或存安全点，队伍记录入口、路线与还没完成的区域。|首领与宝箱位置由世界生成决定；新加模组内容未必出现在旧区块。',
 '攻略说有建筑却找不到：生成、维度与数据包可能不同，先确认服务器。|抢先开箱与掉落分配在游戏内另行协商；网站不替你分配物品。','map rescue bosses end-eyes','dungeons_arise idas integrated_stronghold grimkingdoms betterdungeons')
add('bosses','探索','從首領前置到戰利品收藏','前置材料、召唤位置与退出机制往往比伤害面板更重要。','',
 '在首领图鉴找目标，先读出现地点、召唤方式與前置物品，再準备交通與回收。|建立安全试验场，远离殖民地和重要机器；特殊事件威胁不一定适合按普通首领击杀处理。|第一次以识别招式、保命和撤退为目标；看血量阶段、范围与危险窗口。|确定稳定打法后再刷掉落，并把装备、技能与成就一起记录。|同一首领不同状态不是不同收藏对象；不确定能否馴服的生物不列成夥伴。',
 '生命、爆炸范围与掉落概率可能被伺服器覆盖；本機资料不是實戰驗證。','combat scarlet expedition companions','cataclysm fdbosses block_factorys_bosses legendary_monsters mowziesmobs aquamirae')
add('scarlet','探索','緋紅獵人：把準備做對，再迎戰','四份原攻略中的緋紅猎人實戰手冊保留完整配装、招式、范围與节奏。','',
 '先打开緋紅猎人原攻略，选一套自己能取得的配置，不要只抄主手武器。|按装备、法术和技能收藏頁逐项补齐，再在訓练区確認实际按键與持握。|先讀核心机制、破盾、血刃与回血，再练習一套可靠的防守反擊。|战斗结束记下失误阶段，下一次只调整一个可验证的问题。',
 '本机技能与特殊能力按键可能与原攻略截图不同，请以操作页和个人设置为准。','equipment-training magic bosses','nightfall_invade')
add('companions','探索','夥伴、坐騎與龍族','先分清馴服、繁殖、孵化與仅仅跟随，再决定要带谁遠征。','',
 '在夥伴与坐骑图鉴查看目标的实际饲料、地点与互动条件；同类动物不能一概用相同食物。|先準备安全围栏与回程路线，用正确物品互动，查看所有权或馴服反馈。|坐骑需確認是否有鞍、装备、成长或控制要求；先在附近练习骑乘和下坐。|龙蛋与幼龙依对应类型的孵化、餵养与成长规则处理，不把不同龙族模组混成一套。|外出时留食物与恢复手段，將珍稀伙伴先养在安全基地。',
 '喂了却不馴服：可能是繁殖食物、诱引食物或缺少其他条件。|首领形态或套袋状态不等于玩家夥伴。','bosses flight food','alexsmobs dragonsofberk saintsdragons adorablehamsterpets')
add('end-eyes','探索','通往終界的眼睛收集','这个世界的终界探索可能要求你先走遍不同环境与挑战。','',
 '本包安装 End Remastered。打开物品与成就页，列出各种眼睛的本机取得条件。|依来源安排地牢、生态域与首领遠征，記下已取得種類，不把多个相同眼睛当成多种。|抵达要塞后先观察传送门实际规则，再决定需要补哪些眼睛。|开启终界前准备回程与龙战；龙战调整由服务器规则决定。',
 '服务器可能修改传送门与眼睛要求，网站不凭安装檔名决定必需数量。','expedition bosses map','endrem dragonfight betterstrongholds')
add('advancements','收藏','成就全收集：按前置與條件规划','游戏内成就称作进度。本站把显示成就、隐藏成就和内部配方触发分开。','',
 '成就頁默认隐藏剧透项目，需要时打开「显示隐藏成就」。选择领域或搜尋目标。|先查看前置链，前置成就帮助规划路线，但图示父节点不一定是触发判定的硬性条件。|展开达成条件：每个条件组内任一條即可，同時必须完成全部条件组；多生态域、多食物、多生物的项目可逐项勾记。|点击相关物品、配方與领域教學安排步骤。模组自订条件与程式触发会明示来源限制，需依描述在游戏中验证。|完成后手动勾选；网站勾选不代表游戏已解锁，不读取存档也不会授予奖励。',
 '当前客户端共盘点到1,108个有显示资料的成就，服务器额外内容与启用状态尚未确认。|没有显示资料的内部进度不计收藏百分比。','start expedition colony-research','')
add('enchanting','生產','附魔、經驗與装备回收','把经验供應、強化与回收當成一條独立服务线。','',
 '先查看目标装备支持的附魔與升级，普通附魔、模组强化和技能属性不能互相替代。|需要回收附魔时先在去附魔或编辑工作站看成本與结果，用备用装备试一次。|经验加工与自动附魔设备先确认液体、能源、书与输出；不要把经验仓当作普通流体箱。|刷怪、刷经验与生成器改造受到服务器规则影响，先小规模測試并確認允许。',
 '装备失去属性后无法復原：操作前必须看结果預覽與消耗。|经验来源不稳定时先查生成条件、区块載入與容量。','equipment-training spawners factory','create_enchantment_industry disenchantmentedit spawnermod')
add('spawners','生產','刷怪、材料与安全的生产场','把产出、怪物上限与基地安全一起考虑。','',
 '查生成器改造或机械生成设备实际配方，确认它支持的怪物与材料。|先造能隔离怪物的试验区，留手动停止开关与照明，遠离居民与同队住宅。|看生成条件与实际产出，再连接收集和仓储；缺少目标来源时不要用指令替代生存取得。|设置满仓停止与定期检查，避免无人管理的怪物堆积影响全队。',
 '本機沒辦法確認伺服器生物上限与生成规则，不保证刷怪场效率。','ore enchanting land','spawnermod create_mechanical_spawner')
add('artillery','戰鬥','重型火力與基地防衛','工厂能提供武器，但火力测试需要独立空间。','',
 '在物品清单查火炮、炮架、弹药與组装工具，按本包配方建立金属加工供應。|装配前核对材料、炮管、底座、点火与弹药相容，按游戏说明操作。|先在远离住家與殖民地的位置做最小规模测试，安排人员、清空射线与回收路线。|确认玩法与服务器允许后，再把补给與岗位寫成队伍建设或防卫任务。',
 '本网站不会把未经遊戲驗證的射程、爆炸规模與船载相容性当成定值。','guns factory-brass power','createbigcannons immersive_ballistic')
add('life','定居','帝国里的日常：外观、音樂与公共空间','不是所有进度都来自战斗；给长期居住的世界留下自己的风格。','',
 '外观盔甲与玩家模型只改变显示时，仍要确认真正的装备属性与队友所見。|绘画、唱片、音乐盒与网页显示设备先查本機物品用途，再规划酒馆、公告栏或公共空间。|公开网页显示或外部媒体内容需要每位玩家相容的客户端；服务器装了不代表每个人都能看。|把队伍活动和建设成果记成里程碑，结合收藏页选一个下一次共同目标。',
 '外部媒体可能需要网络与服务权限，网站不保证所有设备或资源可加载。','decor requests party','ysm immersive_paintings musicbox music_disc_maker webdisplaystogether')
def label(id):
 for prefix in ['item','block','entity']:
  k=prefix+'.'+id.replace(':','.')
  if k in L['zh_tw']:return L['zh_tw'][k]
  if k in L['en_us']:return L['en_us'][k]
 return id
def result_ids(d):
 v=d.get('result',d.get('results',[]));v=v if isinstance(v,list) else [v];return [x if isinstance(x,str) else x.get('item') for x in v if isinstance(x,(str,dict))]
all_items={i for a in A for i in a['items']}
recipe_cards={}
for id in all_items:
 rr=[{'id':k,**v} for k,v in R.items() if id in result_ids(v['raw'])]
 recipe_cards[id]={'name':label(id),'recipes':rr[:8]}
for a in A:
 a['items']=[{'id':id,'name':label(id),'hasRecipe':bool(recipe_cards[id]['recipes'])} for id in a['items']]
 a['evidence']='本機模組資源、配方與按鍵盤點；步驟尚未逐項遊戲內驗收'
(D/'articles.json').write_text(json.dumps(A,ensure_ascii=False,separators=(',',':')),encoding='utf8')
(D/'tutorial-recipes.json').write_text(json.dumps(recipe_cards,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('articles',len(A),'recipe cards',len(recipe_cards))
