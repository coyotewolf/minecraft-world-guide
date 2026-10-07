"""Build typed name/alias evidence from this installed pack, never infer mechanics."""
import argparse,hashlib,json,pathlib,re,zipfile
arg=argparse.ArgumentParser();arg.add_argument('--instance',default=r'D:\Games\MultiMC\instances\1.20.1\.minecraft');args=arg.parse_args()
root=pathlib.Path(args.instance);out=pathlib.Path(__file__).resolve().parents[1]/'data/ai'
names={};aliases={};descriptions={};origins={};hashes={};errors=[]
def decode(raw):
 text=raw.decode('utf-8-sig');decoder=json.JSONDecoder();pos=0;result={}
 while text[pos:].strip():
  pos+=len(text[pos:])-len(text[pos:].lstrip());obj,end=decoder.raw_decode(text,pos);result.update(obj);pos=end
 return result
def language(data,source,lang):
 for key,value in data.items():
  match=re.fullmatch(r'(enchantment|effect)\.([a-z0-9_]+)\.([a-z0-9_]+)',key)
  if match and isinstance(value,str):
   aliases.setdefault(key,set()).add(value);origins.setdefault(key,[]).append(source)
   names.setdefault(key,{})[lang]=value
  match=re.fullmatch(r'(enchantment|effect)\.([a-z0-9_]+)\.([a-z0-9_]+)\.desc',key)
  if match and isinstance(value,str):descriptions.setdefault(key[:-5],{})[lang]=(value,source)
def archive(file,override=False):
 with zipfile.ZipFile(file) as z:
  for path in z.namelist():
   match=re.fullmatch(r'assets/[^/]+/lang/(en_us|zh_tw|zh_cn)\.json',path)
   if match and (not override or match[1]=='zh_tw'):
    try:
     data=decode(z.read(path))
     if override:data={k:v for k,v in data.items() if k.removesuffix('.desc') in names}
     language(data,file.name+'!'+path,match[1])
    except Exception as e:errors.append({'source':file.name+'!'+path,'error':str(e)})
for file in sorted((root/'mods').glob('*.jar')):archive(file)
# Vanilla 1.20.1 language assets are pinned by MultiMC asset index 5.
assets=root.parents[2]/'assets';index=assets/'indexes/5.json'
if index.exists():
 for key,obj in json.loads(index.read_text())['objects'].items():
  if key in ['minecraft/lang/zh_tw.json','minecraft/lang/en_us.json']:
   h=obj['hash'];file=assets/'objects'/h[:2]/h
   if file.exists():language(decode(file.read_bytes()),'MultiMC assets index 5!'+key,key.split('/')[-1][:-5])
options=dict(x.split(':',1) for x in (root/'options.txt').read_text(encoding='utf8').splitlines() if ':' in x)
for entry in json.loads(options.get('resourcePacks','[]')):
 if entry.startswith('file/'):
  file=root/'resourcepacks'/entry[5:]
  if file.is_file() and file.suffix=='.zip':archive(file,True)
records=[]
for key,langs in names.items():
 kind,ns,leaf=key.split('.');desc=descriptions.get(key,{})
 preferred=langs.get('zh_tw') or langs.get('en_us') or langs.get('zh_cn') or key
 value,source=desc.get('zh_tw') or desc.get('en_us') or desc.get('zh_cn') or ('',origins[key][-1])
 records.append({'id':ns+':'+leaf,'type':kind,'name':preferred,'translationKey':key,'aliases':sorted(aliases[key]),'description':value,'source':source,'scope':'目前安裝模組／啟用資源包的名稱與說明文字；名稱不代表已人工核對完整機制。','refs':[]})
# Link class definitions and callers across mods, including mixins, without guessing effects.
stems={}
for r in records:
 stem=re.sub('[^a-z0-9]','',r['id'].split(':')[1]);stems.setdefault((r['type'],stem),[]).append(r)
manifest=json.loads((out/'manifest.json').read_text())
for shard in manifest['shards']:
 for fact in json.loads((out/shard['file']).read_text()):
  if not fact.get('runtimeEvidence'):continue
  for cls in set(re.findall(r'\b[A-Z][A-Za-z0-9_$]*(?:Enchantment|Effect)\b',fact.get('text',''))):
   kind='enchantment' if cls.endswith('Enchantment') else 'effect';stem=cls.removesuffix('Enchantment').removesuffix('Effect').lower()
   for r in stems.get((kind,stem),[]):
    ref={'file':shard['file'],'factId':fact['id'],'definition':bool(re.search(r'\bclass\s+'+re.escape(cls)+r'\b',fact.get('text','')))}
    if ref not in r['refs']:r['refs'].append(ref)
for record in records:record['refs'].sort(key=lambda ref:not ref['definition'])
create=next((root/'mods').glob('*create-1.20.1-6.0.8.jar'));sha=hashlib.sha256(create.read_bytes()).hexdigest()
if not sha.startswith('6fbb910c367dbce8'):raise RuntimeError('Create JAR changed; re-review capacity mechanics before building')
capacity=next(r for r in records if r['translationKey']=='enchantment.create.capacity')
capacity['reviewedSummary']='「容量」是機械動力的背罐附魔，目前啟用的繁中翻譯稱為「擴充」。增加可儲存的空氣上限，不是法術書欄位或一般背包格數，也不會自動把空氣充滿。銅製背罐與獄髓背罐都使用可接受此附魔的背罐介面。正常最高 III。模組預設基礎空氣 900，每級增加 300，I／II／III 為 1200／1500／1800；公式是基礎容量＋每級額外容量×附魔等級，伺服器可修改這兩個設定，尚未取得實際伺服器設定。Northstar 另將其 oxygen_sources 標籤的物品納入附魔可用範圍，不能說只有銅背罐能用；Clockwork 的特殊氣體背罐有獨立容量覆寫，不能把上述數字套用到它。'
capacity['reviewedSources']=[create.name+'!com/simibubi/create/'+s+'.class' for s in ['AllEnchantments','AllItems','content/equipment/armor/CapacityEnchantment','content/equipment/armor/BacktankItem','content/equipment/armor/BacktankUtil','infrastructure/config/CEquipment']]+['Northstar!com/lightning/northstar/mixin/compat/create/CapacityEnchantmentMixin.class','Clockwork!org/valkyrienskies/clockwork/mixin/content/gas/MixinBacktankUtil.class']
northstar=next((root/'mods').glob('*northstar*.jar'));clockwork=next((root/'mods').glob('*clockwork*.jar'))
for jar,prefix in [(northstar,'10674d9c841fd5f4'),(clockwork,'0b615700e22ed8f8')]:
 if not hashlib.sha256(jar.read_bytes()).hexdigest().startswith(prefix):raise RuntimeError(jar.name+' changed; re-review overrides')
capacity['reviewedSources']=[source.replace('Northstar!',northstar.name+'!').replace('Clockwork!',clockwork.name+'!') for source in capacity['reviewedSources']]
capacity['sha256']=sha;capacity['scope']='容量附魔的登錄、適用背罐、等級及容量公式已核對目前安裝 Create 6.0.8 程式，並檢查 Northstar／Clockwork 覆寫；數值是預設，非實際伺服器驗證。'
result={'version':1,'records':records,'errors':errors,'scope':'全部目前安裝模組的附魔與狀態效果名稱；依 options.txt 啟用順序套用繁中翻譯，保留原語言與舊名別名。語言資料未保證每個條目都可取得。'}
body=json.dumps(result,ensure_ascii=False,separators=(',',':'));(out/'subject-registry.json').write_text(body,encoding='utf8')
manifest['subjectRegistry']='subject-registry.json';manifest['version']=hashlib.sha256(json.dumps(manifest['shards'],sort_keys=True).encode()+body.encode()).hexdigest()[:20];(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(json.dumps({'records':len(records),'enchantments':sum(r['type']=='enchantment' for r in records),'effects':sum(r['type']=='effect' for r in records),'linkedRecords':sum(bool(r['refs']) for r in records),'capacityName':capacity['name'],'capacityAliases':capacity['aliases'],'errors':errors},ensure_ascii=False))
