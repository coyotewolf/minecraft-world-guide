"""Build item-picker labels from installed item/block language keys and existing artwork."""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1];data=root/'data'
languages=json.loads((data/'languages.json').read_text(encoding='utf8'));icons=json.loads((data/'icons.json').read_text(encoding='utf8'));existing=json.loads((data/'names.json').read_text(encoding='utf8'));items={}
for lang in ['en_us','zh_tw']:
 for key,label in languages[lang].items():
  if not key.startswith(('item.','block.')) or not isinstance(label,str):continue
  ns,_,path=key.split('.',1)[1].partition('.');ident=ns+':'+path
  if ident in icons:items[ident]=re.sub('§[0-9a-fk-or]','',label,flags=re.I)
for c in json.loads((data/'collections.json').read_text(encoding='utf8')):
 if c['category']=='equipment' and c['id'] in icons:items.setdefault(c['id'],existing.get(c['id'],c['title']))
(data/'request-items.json').write_text(json.dumps(items,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('Picker includes',len(items),'real item/block IDs with available game artwork.')
