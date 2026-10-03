import json,pathlib,sys,re
sys.path.insert(0,str(pathlib.Path('work/chinese_lib').resolve()))
from opencc import OpenCC
P=pathlib.Path(__file__).resolve().parents[1];D=P/'data';cc=OpenCC('s2twp')
def convert(x):
 if isinstance(x,str):return cc.convert(x)
 if isinstance(x,list):return list(map(convert,x))
 if isinstance(x,dict):return {k:convert(v) for k,v in x.items()}
 return x
a=json.loads((D/'advancements.json').read_text(encoding='utf8'))
manual={
'acorn_music_disc':('最後的樂章','與曾被你治癒的同一隻倉鼠完成橡實唱片儀式。'),
'breeder_1':('創造新生命','繁殖倉鼠，發現第一種獨特的倉鼠組合。'),
'breeder_100':('基因攪拌機','繁殖並發現 100 種獨特的倉鼠組合。'),
'breeder_500':('染色體混沌','繁殖並發現 500 種獨特的倉鼠組合。'),
'breeder_1000':('無盡鼠潮','繁殖並發現 1,000 種獨特的倉鼠組合。'),
'breeder_1000000':('百萬聲吱吱','繁殖並發現 1,000,000 種獨特的倉鼠組合。'),
'carat_confusion':('克拉的誤會','目睹倉鼠發現自己找到的東西並不是鑽石時的失望。'),
'collector_10':('業餘動物學家','收集 10 種獨特的野生倉鼠。'),
'collector_50':('生活的調味','收集 50 種獨特的野生倉鼠。'),
'collector_100':('收集一小部分','收集 100 種獨特的野生倉鼠。'),
'collector_1000':('收藏的執念','收集 1,000 種獨特的野生倉鼠。'),
'collector_max':('真的全部抓到了','馴服所有自然出現的倉鼠變種。'),
'funky_beats':('放克節拍','讓時間盡頭的水池將你的乳酪陳化成低傳真音樂作品。'),
'hide_and_squeak':('捉迷藏與吱吱聲','在時間耗盡之前找到你的倉鼠。'),
'load_bearing_human':('承重的人類','成為一座倉鼠堆疊高塔的支撐。'),
'moist_tones':('潮濕的旋律','讓達到終端速度的倉鼠撞上會行走的閃電炸彈，取得傳奇乳酪唱片。'),
'redstone_fever':('紅石熱病','發現一隻患有紅石熱病的倉鼠。'),
'seeing_red':('紅眼傳承','成功繁殖出具有隱性紅眼性狀的倉鼠。'),
'sunshine_curing':('長笛輔助療癒','以持續的直射陽光和音樂治癒發燒的倉鼠。'),
'symphonic_cheese':('交響乳酪','與來自地獄的商人交易音樂乳酪，使它提升為冒險風格。'),
}
idas={
'ancient_mines':('古老礦坑','深處的鼓聲正在呼喚……'),
'apothecary_abode':('藥劑師的居所','樹林間一棟鮮明、魔幻卻扭曲的建築……'),
'archmages_tower':('大法師之塔','你能征服這座危險的魔法塔嗎？'),
'bearclaw_inn':('熊爪旅店','疲憊旅人的歇腳處。'),
'castle':('城堡','村民的堡壘。'),
'desert_pyramid':('沙漠金字塔','在金字塔四周刷掃，也許能發現隱藏的東西……'),
'dread_citadel':('恐懼堡壘','不祥的堡壘正在等待……'),
'enchantingtower':('附魔之塔','牧師的高塔。'),
'fishermans_lodge':('漁夫小屋','湖畔的漁夫。'),
'hunters_cabin':('獵人小屋','樹林中的獵人。'),
'idas_root':('地牢與建築探險','開始探索建築！'),
'labyrinth':('巨蛇迷宮','願命運站在你這邊……'),
'necromancers_spire':('死靈法師尖塔','令人戰慄的邪惡潛藏其中……'),
'nexus':('交匯之地','通往多重現實的入口。'),
'pillager_fortress':('掠奪者堡壘','將掠奪者的家洗劫一空。'),
'redhorn_guild':('紅角公會','避難所與訓練場所。'),
'ruins_of_the_deep':('深淵遺跡','你敢前往深處嗎？'),
'sunken_ship':('沉船','船長總是與船一同沉沒……'),
'tinkers_citadel':('工匠堡壘','齒輪與機殼工匠們的安全避風港。'),
'tinkers_workshop':('工匠工坊','成為工匠最新的試驗對象……'),
'winter_wagon':('冬日馬車','帶著節慶氣氛的旅行馬車。'),
'witches_treestump':('女巫樹樁','森林中的黑魔法之地。'),
'wizardtower':('巫師之塔','法師的尖塔。')}
for x in a:
 ns,leaf=x['id'].split(':',1);tail=leaf.rsplit('/',1)[-1];pair=None
 if ns=='adorablehamsterpets' and tail in manual:pair=manual[tail]
 if ns=='idas' and leaf in idas:pair=idas[leaf]
 if pair:
  x['originalTitle']=x['title'];x['originalDescription']=x['description'];x['title'],x['description']=pair;x['webTranslation']=True
 if ns=='monsterexpansion' and x['title'].startswith('advancements.'):
  lookup={'craft_duskrend':('鍛造暮裂','在對應鍛造工作站製作 Duskrend。'),'craft_horn_of_the_shattercry':('碎鳴之號','製作 Horn of the Shattercry。'),'craft_monster_armor':('怪物防具','在對應工作站製作成就指定的怪物防具。'),'crafted_spire_shell_bulwark':('尖殼壁壘','製作 Spire Shell Bulwark。'),'hunt_large_monster':('大型怪物獵人','擊殺成就條件列出的任一大型怪物。'),'hunt_leivekilth':('狩獵 Leivekilth','由玩家擊殺 Leivekilth。'),'hunt_rakoth':('狩獵 Rakoth','由玩家擊殺 Rakoth。'),'hunt_rhyza':('狩獵 Rhyza','由玩家擊殺 Rhyza。'),'hunt_skrythe':('狩獵 Skrythe','由玩家擊殺 Skrythe。')}
  if leaf in lookup:x['title'],x['description']=lookup[leaf];x['webTranslation']=True
 specials={'alexsmobs:alexsmobs/straddleboard':('跨板衝浪',None),'betterdungeons:root':('更好的地牢',None),'butchercraft:extruder':('三、二、一……',None),'butchercraft:root':('肉品加工',None),'create:extendo_grip':('伸長吧！',None),'dungeons_arise:find_bathhouse':(None,'詛咒。'),'dungeons_arise:find_scorched_mines':(None,'深入地下。'),'dungeons_arise:find_typhon':('堤豐','巨顎。'),'fdbosses:qliphoth_awakening/root':('逆卡巴拉覺醒',None),'irons_spellbooks:irons_spellbooks/root':('秘法與法書',None),'mowziesmobs:root':('奇異生物',None),'slu:souls_like_universe':('魂系世界',None),'webdisplaystogether:root':('一起觀看網頁','網頁顯示與互動。')}
 if x['id'] in specials:
  title,desc=specials[x['id']];x['title']=title or x['title'];x['description']=desc or x['description']
(D/'advancements.json').write_text(json.dumps(convert(a),ensure_ascii=False,separators=(',',':')),encoding='utf8')
# Resolve hand-authored item identifiers using the actual recipe output and language resources.
articles=json.loads((D/'articles.json').read_text(encoding='utf8'))
for a in articles:
 for item in a['items']:
  if item['id']=='create:train_station':item['id']='create:track_station';item['name']='火車站'
  if item['id']=='create:train_controls':item['id']='create:controls';item['name']='列車控制器'
  if item['id']=='minecolonies:buildtool':item['id']='structurize:build_tool';item['name']='建築工具'
  if item['id']=='minecolonies:blockhutrestaurant':item['id']='minecolonies:blockhutcook';item['name']='餐廳'
  if item['id']=='vs_eureka:ship_helm':item['id']='vs_eureka:oak_ship_helm';item['name']='橡木船舵'
  if item['id']=='enderstorage:ender_storage':item['id']='enderstorage:ender_chest';item['name']='終界儲物箱'
  if item['id']=='tetra:workbench':item['name']='工作台（依遊戲內提示以工具改造）'
(D/'articles.json').write_text(json.dumps(convert(articles),ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('localized',len(a) if isinstance(a,list) else 'advancement and tutorial content')
