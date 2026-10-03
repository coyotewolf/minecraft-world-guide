import json,pathlib,collections,sys
sys.stdout.reconfigure(encoding='utf-8')
p=pathlib.Path(__file__).resolve().parents[1]/'data'
for file in ['equipment-shape.json','summary.json']:
 d=json.loads((p/file).read_text(encoding='utf-8'))
 if file=='summary.json':print('ERRORS',json.dumps(d['errors'][:8],ensure_ascii=False));print('OVERRIDES',json.dumps(d['overrides'][:3],ensure_ascii=False))
 else:print(json.dumps(d,ensure_ascii=False,indent=2)[:7000])
a=json.loads((p/'advancements.json').read_text(encoding='utf-8'))
print('NAMESPACES',collections.Counter(x['id'].split(':')[0] for x in a))
print('TRIGGERS',collections.Counter(c['trigger'] for x in a for c in x['criteria']))
for ns in ['minecraft','minecolonies','create','ae2','irons_spellbooks']:
 print(ns,json.dumps([x for x in a if x['id'].startswith(ns+':')][:1],ensure_ascii=False)[:1300])
