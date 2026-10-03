"""Finalize player terminology and tutorial recipes after scanning the installed pack."""
import json,pathlib,sys
P=pathlib.Path(__file__).resolve().parents[1];D=P/'data'
A=json.loads((D/'articles.json').read_text(encoding='utf8'));R=json.loads((D/'recipes.json').read_text(encoding='utf8'));L=json.loads((D/'languages.json').read_text(encoding='utf8'))
aliases={'epiccolonies':'epic_colonies','extendedae':'expatternprovider','clockwork':'vs_clockwork','grappling_hook_mod':'grapplemod','tacz_tweaks':'tacztweaks','toollevelingrework':'tlr','dungeons_arise':'integrated_dungeons_arise','integrated_stronghold':'idas','grimkingdoms':'mr_grim_kingdomsloststructuresruins','disenchantmentedit':'editenchanting','ysm':'yes_steve_model'}
N={}
for lang in ['en_us','zh_tw']:
 for k,v in L[lang].items():
  if k.startswith(('item.','block.','entity.')):
   ns,_,path=k.split('.',1)[1].partition('.');N[ns+':'+path]=v
for a in A:
 a['mods']=list(dict.fromkeys(aliases.get(m,m) for m in a['mods']))
 for x in a['items']:
  if x['id']=='structurize:build_tool':x.update(id='structurize:sceptergold',name='建造工具')
  if x['id']=='tetra:workbench':x.update(id='minecraft:crafting_table',name='工作台（用木槌改造成工具工作台）')
 if a['id']=='guns':
  a['items']=[{'id':'tacz:gun_smith_table','name':'槍械工作台'},{'id':'tacz:ammo_box','name':'彈藥箱'}]
  a['steps'][0]='先製作槍械工作台：上排三格原木；中排鐵錠、鐵方塊、鐵錠；下排左右放鐵錠。右鍵開啟工作台，選槍械或彈藥，依工作台顯示備齊材料。槍包配方可能另行調整。'
  a['steps'][2]='本機目前是左鍵射擊、右鍵瞄準、R 換彈、H 檢查、G 切換射擊模式、J 改裝、Ctrl＋R 卸彈。這些可能與戰鬥技能撞鍵；先到控制設定確認個人的實際配置。'
 if a['id']=='equipment-training':a['steps'][1]='先在普通工作台合成木槌，手持木槌以右鍵敲擊工作台，改造成工具工作台。把工具放入工作台，再選部件、材料與改良；若提示槌等級不足，先升級木槌或準備工作台要求的工具。'
 if a['id']=='colony-start':a['steps'][0]='準備木材、石材、鐵、煤、羊毛、食物與工具。建造工具的三格斜線配方是左下與中間各一根木棒、右上一個石材；市政廳與小屋方塊可點上方查看配方。先取得補給營地或補給船，按放置預覽操作。'
def ids(v):
 if isinstance(v,str):return [v]
 if isinstance(v,list):return sum((ids(x) for x in v),[])
 if isinstance(v,dict):return [v.get('item',v.get('id'))]
 return []
cards={}
for a in A:
 for x in a['items']:
  ident=x['id'];rr=[{'id':k,**v} for k,v in R.items() if ident in ids(v['raw'].get('result',v['raw'].get('results',[])))];cards[ident]={'name':x['name'],'recipes':rr[:8]};x['hasRecipe']=bool(rr)
refs=set()
def scan(x):
 if isinstance(x,str) and x in N:refs.add(x)
 elif isinstance(x,dict):
  for k,v in x.items():scan(k);scan(v)
 elif isinstance(x,list):
  for v in x:scan(v)
scan(A);scan(cards)
for f in ['collections','advancements']:scan(json.loads((D/(f+'.json')).read_text(encoding='utf8')))
for name,value in [('articles',A),('tutorial-recipes',cards),('names',{k:N[k] for k in refs})]:(D/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf8')
S=json.loads((D/'summary.json').read_text(encoding='utf8'))
for e in S['errors']:
 if 'source'in e:e['source']=pathlib.Path(e['source']).name
(D/'summary.json').write_text(json.dumps(S,ensure_ascii=False,separators=(',',':')),encoding='utf8')
assert all(m in S['modIds'] for a in A for m in a['mods'])
print('Finalized',len(A),'player tutorials and',len(cards),'recipe cards.')

V=json.loads((D/'advancements.json').read_text(encoding='utf8'));known={v['id'] for v in V}
for v in V:v['missingParent']=bool(v['parent'] and v['parent'] not in known)
(D/'advancements.json').write_text(json.dumps(V,ensure_ascii=False,separators=(',',':')),encoding='utf8')
