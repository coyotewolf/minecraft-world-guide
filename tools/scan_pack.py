"""Read-only extraction. Never reads player saves, account files or server addresses."""
import pathlib,zipfile,json,re,tomllib,hashlib,sys,collections
sys.path.insert(0,str(pathlib.Path('work/boss_lib').resolve()))
from bs4 import BeautifulSoup
ROOT=pathlib.Path(r'D:\Games\MultiMC\instances\1.20.1\.minecraft')
OUT=pathlib.Path(__file__).resolve().parents[1]
LANG={'en_us':{},'zh_tw':{}}; ADV={};RECIPES={};MODS=[];ERRORS=[];OVERRIDES=[];SOURCES={};FILES={}
def read_json(z,n):
 raw=z.read(n).decode('utf-8-sig')
 try:return json.loads(raw)
 except Exception as e:
  if '/lang/' in n:
   # Some supplied translations contain consecutive complete JSON objects.
   result={};pos=0;decoder=json.JSONDecoder()
   while pos<len(raw):
    while pos<len(raw) and raw[pos].isspace():pos+=1
    if pos>=len(raw):break
    try:d,end=decoder.raw_decode(raw,pos)
    except Exception:break
    if isinstance(d,dict):result.update(d)
    pos=end
   if result:
    ERRORS.append({'source':str(z.filename),'path':n,'error':str(e),'recovered':True});return result
  ERRORS.append({'source':str(z.filename),'path':n,'error':str(e),'recovered':False});return None
def scan_archive(p,origin='mod'):
 try:
  with zipfile.ZipFile(p) as z:
   names=z.namelist(); meta=[]
   if 'META-INF/mods.toml' in names:
    try:
     d=tomllib.loads(z.read('META-INF/mods.toml').decode('utf-8-sig'))
     meta=[{'id':m.get('modId'),'name':m.get('displayName',m.get('modId')),'version':m.get('version'),'description':m.get('description','')} for m in d.get('mods',[])]
    except Exception as e:ERRORS.append({'source':p.name,'error':str(e)})
   elif 'fabric.mod.json' in names:
    d=read_json(z,'fabric.mod.json') or {};meta=[{'id':d.get('id'),'name':d.get('name',d.get('id')),'version':d.get('version'),'description':d.get('description','')}]
   if origin=='mod':MODS.append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mods':meta})
   for n in names:
    if re.match(r'assets/[^/]+/lang/(en_us|zh_tw)\.json$',n):
     d=read_json(z,n)
     if isinstance(d,dict):LANG[n.rsplit('/',1)[-1][:-5]].update(d)
    m=re.search(r'^data/([^/]+)/(advancements|recipes)/(.+)\.json$',n)
    if m:
     d=read_json(z,n)
     if not isinstance(d,dict):continue
     ident=m[1]+':'+m[3];table=ADV if m[2]=='advancements' else RECIPES
     source={'archive':p.name,'path':n,'origin':origin}
     if ident in table:OVERRIDES.append({'kind':m[2],'id':ident,'previous':table[ident]['source'],'next':source})
     table[ident]={'raw':d,'source':source}
    if n.startswith(('data/','assets/')):FILES.setdefault(n,p.name)
 except Exception as e:ERRORS.append({'source':p.name,'error':str(e)})
vanilla=pathlib.Path(r'D:\Games\MultiMC\libraries\net\minecraft\client\1.20.1-20230612.114412\client-1.20.1-20230612.114412-extra.jar')
scan_archive(vanilla,'vanilla')
for p in sorted((ROOT/'mods').glob('*.jar')):scan_archive(p)
# Local global datapacks are candidates, not proof of server activation.
for folder in ['moonlight-global-datapacks','config/paxi/datapacks','config/openloader/data','datapacks']:
 base=ROOT/folder
 if not base.exists():continue
 for p in sorted(base.rglob('*')):
  if p.suffix in ['.zip','.jar']:scan_archive(p,'local-datapack-candidate')
  elif p.suffix=='.json':
   m=re.search(r'data/([^/]+)/advancements/(.+)\.json$',p.as_posix())
   if m:
    try:ADV[m[1]+':'+m[2]]={'raw':json.loads(p.read_text(encoding='utf-8-sig')),'source':{'archive':folder,'path':p.relative_to(ROOT).as_posix(),'origin':'local-datapack-candidate'}}
    except Exception as e:ERRORS.append({'source':str(p),'error':str(e)})
options={}
for line in (ROOT/'options.txt').read_text(encoding='utf-8').splitlines():
 if ':' in line:
  k,v=line.split(':',1)
  if k.startswith('key_') or k in ['lang','resourcePacks']:options[k]=v
# Vanilla Traditional Chinese comes from the asset index, not necessarily the client JAR.
for p in pathlib.Path(r'D:\Games\MultiMC\assets\indexes').glob('*.json'):
 try:
  d=json.loads(p.read_text()); obj=d.get('objects',{}).get('minecraft/lang/zh_tw.json')
  if obj:
   h=obj['hash'];asset=p.parent.parent/'objects'/h[:2]/h
   if asset.exists():LANG['zh_tw'].update(json.loads(asset.read_text(encoding='utf-8')));break
 except Exception:pass
enabled=[]
try:enabled=json.loads(options.get('resourcePacks','[]'))
except Exception:pass
for name in enabled:
 if name.startswith('file/'):
  p=ROOT/'resourcepacks'/name[5:]
  if p.is_file():
   with zipfile.ZipFile(p) as z:
    for n in z.namelist():
     if n.endswith('/lang/zh_tw.json'):
      d=read_json(z,n)
      if isinstance(d,dict):LANG['zh_tw'].update(d)
# Web terminology may use supplied translation packs even when the player's client has not enabled them.
for p in sorted((ROOT/'resourcepacks').glob('*.zip')):
 try:
  with zipfile.ZipFile(p) as z:
   for n in z.namelist():
    if n.endswith('/lang/zh_tw.json'):
     d=read_json(z,n)
     if isinstance(d,dict):LANG['zh_tw'].update(d)
 except Exception as e:ERRORS.append({'source':p.name,'error':str(e)})
def tr(v):
 if isinstance(v,str):return v
 if isinstance(v,list):return ''.join(map(tr,v))
 if isinstance(v,dict):
  t=v.get('text') or LANG['zh_tw'].get(v.get('translate')) or LANG['en_us'].get(v.get('translate')) or v.get('translate','')
  return str(t)+''.join(tr(x) for x in v.get('extra',[]))
 return ''
def label(ident):
 for prefix in ['item','block','entity','biome','effect']:
  key=prefix+'.'+ident.replace(':','.')
  if key in LANG['zh_tw']:return LANG['zh_tw'][key]
  if key in LANG['en_us']:return LANG['en_us'][key]
 return ident
def describe(c):
 trigger=c.get('trigger','');co=c.get('conditions',{}); out=[]
 names={'minecraft:inventory_changed':'取得並放入背包','minecraft:consume_item':'食用或飲用','minecraft:player_killed_entity':'由玩家擊殺','minecraft:entity_killed_player':'被指定生物擊殺','minecraft:location':'抵達指定地點','minecraft:changed_dimension':'切換維度','minecraft:tame_animal':'馴服動物','minecraft:breed_animals':'繁殖動物','minecraft:enchanted_item':'附魔物品','minecraft:used_totem':'使用不死圖騰','minecraft:levitation':'在飄浮狀態下移動','minecraft:hero_of_the_village':'獲得村莊英雄','minecraft:voluntary_exile':'帶著不祥之兆進入村莊','minecraft:impossible':'由模組程式或指令觸發；需依成就描述操作','minecraft:recipe_unlocked':'解鎖配方','minecraft:tick':'每遊戲刻檢查条件','minecraft:placed_block':'放置方塊','minecraft:using_item':'持續使用物品','minecraft:shot_crossbow':'射出弩箭','minecraft:killed_by_crossbow':'用弩擊殺','minecraft:effects_changed':'取得指定效果','minecraft:summoned_entity':'召喚生物','minecraft:filled_bucket':'用桶裝入指定內容','minecraft:player_interacted_with_entity':'與生物互動','minecraft:item_used_on_block':'對方塊使用物品','minecraft:slide_down_block':'沿方塊下滑','minecraft:bee_nest_destroyed':'破壞蜂巢','minecraft:fishing_rod_hooked':'用釣竿釣起指定目標','minecraft:nether_travel':'利用地獄跨越距離','minecraft:allay_drop_item_on_block':'讓悅靈送物到指定方塊'}
 out.append(names.get(trigger,'依遊戲成就描述觸發（模組自訂條件）'))
 def walk(x,path=''):
  if isinstance(x,dict):
   for k,v in x.items():
    if k in ['items','potion','biome','dimension','type','block','tag','effect','structure','building','building_name','module','material','improvement','recipe']:
     vals=v if isinstance(v,list) else [v]
     for y in vals:
      if isinstance(y,str):out.append(('符合標籤：' if k=='tag' else '')+label(y))
    if k in ['min','max'] and isinstance(v,(int,float)):out.append(('至少 ' if k=='min' else '最多 ')+str(v)+'（'+path.rsplit('.',1)[-1]+'）')
    if k=='nbt':out.append('需符合指定物品／生物資料')
    if k in ['population_count','level','building_level','count','amount','distance','height','damage'] and isinstance(v,(int,float)):
     out.append({'population_count':'人數','level':'等級','building_level':'建築等級','count':'數量','amount':'數量','distance':'距離','height':'高度','damage':'傷害'}[k]+'：'+str(v))
    walk(v,path+'.'+k)
  elif isinstance(x,list):
   for y in x:walk(y,path)
 walk(co)
 return '；'.join(dict.fromkeys(out))
records=[];technical=[]
for ident,x in sorted(ADV.items()):
 d=x['raw'];display=d.get('display');criter=d.get('criteria',{})
 if not display:
  technical.append({'id':ident,'parent':d.get('parent'),'source':x['source'],'criteria':criter,'requirements':d.get('requirements')});continue
 criteria=[{'key':k,'trigger':v.get('trigger'),'instruction':describe(v),'conditions':v.get('conditions',{})} for k,v in criter.items()]
 req=d.get('requirements') or [[k] for k in criter]
 records.append({'id':ident,'title':tr(display.get('title')),'description':tr(display.get('description')),'parent':d.get('parent'),'hidden':bool(display.get('hidden')),'frame':display.get('frame','task'),'icon':display.get('icon'),'criteria':criteria,'requirements':req,'rewards':d.get('rewards',{}),'source':x['source'],'conditions':d.get('conditions',[]),'customTrigger':any(not c['trigger'].startswith('minecraft:') or c['trigger']=='minecraft:impossible' for c in criteria),'status':'本機資源已查核；伺服器啟用狀態未確認'})
# Preserve all supplied guide content, while making each collection record searchable and cloud-addressable.
catalog=[];original=[]
for filename,slug in [('skills-spells-guide.html','skills'),('scarlet-hunter-guide.html','scarlet'),('特殊武器與防具全收集.html','equipment'),('boss-collection.html','bosses')]:
 p=pathlib.Path('C:/Users/coyot/Downloads')/filename;html=p.read_text(encoding='utf8');s=BeautifulSoup(html,'html.parser')
 (OUT/'guides'/f'{slug}.html').write_text(html,encoding='utf8')
 original.append({'id':slug,'title':s.title.get_text(),'path':f'guides/{slug}.html','sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 if slug=='skills':
  for d in json.loads(s.find('script',type='application/json').string):
   catalog.append({'key':'skills:'+d['id'],'id':d['id'],'title':d['name'],'subtitle':d.get('en',''),'category':'skills','description':d.get('desc',''),'route':d.get('route',''),'status':d.get('status',''),'collectible':d.get('status') not in ['需技能樹模組','本機未找到生存途徑'],'sourceGuide':slug,'details':{k:v for k,v in d.items() if not any(t in k.lower() for t in ['icon','image','img'])}})
 elif slug=='equipment':
  d=json.loads(s.find('script',type='application/json').string)
  (OUT/'data'/'equipment-shape.json').write_text(json.dumps({'keys':list(d),'sample':[{k:(str(v)[:220] if not isinstance(v,(int,float,bool)) else v) for k,v in x.items() if not any(t in k.lower() for t in ['icon','image','img'])} for x in d['items'][:2]]},ensure_ascii=False,indent=2),encoding='utf8')
  for x in d['items']:
   catalog.append({'key':'equipment:'+x['id'],'id':x['id'],'title':x.get('name') or x.get('zh') or x['id'],'subtitle':x.get('en',''),'category':'equipment','description':x.get('description') or x.get('desc',''),'route':x.get('route') or x.get('acquisition',''),'status':x.get('status',''),'collectible':x.get('status')=='已找到來源','sourceGuide':slug,'details':{k:v for k,v in x.items() if not any(t in k.lower() for t in ['icon','image','img'])}})
 elif slug=='bosses':
  for c in s.select('.card,.pet-card'):
   ident=c.get('data-id') or c.get('data-pet-id'); title=c.find(['h3','h4']);desc=c.get_text(' ',strip=True)
   catalog.append({'key':('companion:' if c.get('data-pet-id') else 'boss:')+ident,'id':ident,'title':title.get_text(' ',strip=True) if title else ident,'subtitle':'','category':'companions' if c.get('data-pet-id') else 'bosses','description':desc,'route':'詳見原攻略的取得／召喚／馴服步驟','status':'原攻略收錄；伺服器數值待確認','collectible':True,'sourceGuide':slug,'anchor':c.get('id'),'mount':c.get('data-pet-mount') in ['control','ride'],'details':{}})
 elif slug=='scarlet':
  for c in s.select('.chapter'):
   title=c.find(['h2','h3']);cid=c.get('id');
   if title:catalog.append({'key':'scarlet:'+str(cid),'id':'nightfall_invade:scarlet_hunter','title':title.get_text(' ',strip=True),'subtitle':'緋紅獵人實戰','category':'strategy','description':c.get_text(' ',strip=True),'route':'','status':'原攻略收錄','collectible':True,'sourceGuide':slug,'anchor':cid,'details':{}})
summary={'jarCount':len(MODS),'modIds':sorted({m['id'] for j in MODS for m in j['mods'] if m.get('id')}),'advancementCount':len(records),'technicalAdvancementCount':len(technical),'recipeCount':len(RECIPES),'collectionCount':len(catalog),'resourcePacks':enabled,'scanDate':'2026-10-04','minecraft':'1.20.1','serverVerified':False,'scope':'目前客戶端 JAR、原版資源及本機全域資料包候選；未讀取伺服器或私人存檔','errors':ERRORS,'overrides':OVERRIDES}
for name,data in [('inventory',MODS),('advancements',records),('technical-advancements',technical),('collections',catalog),('summary',summary),('originals',original),('keybindings',options),('recipes',RECIPES),('languages',LANG)]:
 (OUT/'data'/f'{name}.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(json.dumps({k:v for k,v in summary.items() if k not in ['errors','modIds','overrides']},ensure_ascii=False,indent=2));print('errors',len(ERRORS),'overrides',len(OVERRIDES))
