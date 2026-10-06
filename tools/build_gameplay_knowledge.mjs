import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const articles=read('data/articles.json');
const collections=read('data/collections.json');
const inventory=read('data/inventory.json');
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const clip=(v,n)=>clean(v).slice(0,n);
const knowledge=[];
// Collection acquisition data lives in nested player-facing sections. Keeping
// only the old route field silently discarded food, locations and conditions.
function detailsText(value,path='',out=[]){
 if(typeof value==='string'||typeof value==='number'){out.push(path+'：'+clip(value,300));return out}
 if(value&&typeof value==='object')for(const [key,v] of Object.entries(value)){if(!/^(mod|kind|stats|playerStats|method|playerMethod|notes|playerNotes|source|sources|registryId|id)$/.test(key))detailsText(v,path?path+'／'+key:key,out)}
 return out;
}
function uniqueSummary(parts){const kept=[];for(const part of parts.filter(Boolean)){const text=clean(part),value=text.replace(/^[^：]*：/,'');if(value&&!kept.some(x=>x.includes(value)))kept.push(text)}return clip(kept.join('\n'),2200)}
for(const a of articles){
  knowledge.push({
    id:'article:'+a.id,kind:'article',title:a.title,category:a.group||'教學',
    search:clip([a.title,a.intro,...(a.steps||[]),...(a.troubleshooting||[]),...(a.mods||[])].join(' '),1100),
    labels:a.mods||[],source:'網站教學：'+a.title,playerTitle:a.title,
    playerSummary:clip([a.intro,...(a.steps||[]).slice(0,6),...(a.troubleshooting||[]).slice(0,3)].filter(Boolean).join('\n'),1800)
  });
}
for(const x of collections){
  const d=x.details||{},method=d.playerMethod||d.method||x.route||'',stats=d.playerStats||d.stats||{};
  const statText=Object.entries(stats).slice(0,12).map(([k,v])=>k+':'+(typeof v==='object'?JSON.stringify(v):v)).join('；');
  knowledge.push({
    id:'collection:'+x.key,kind:'collection',title:x.title,category:x.category||'收藏',
    search:clip([x.title,x.subtitle,x.id,x.category,x.route,d.mod,d.kind,method,...detailsText(d),statText].filter(Boolean).join(' '),1500),
    labels:[x.subtitle,x.category,d.mod,d.kind].filter(Boolean),source:'收藏冊：'+(x.sourceGuide||x.category||''),
    playerTitle:[x.title,x.subtitle].filter(Boolean).join(' / '),
    playerSummary:uniqueSummary([x.description,method,...detailsText(d),d.playerNotes||d.notes,statText])
  });
}
for(const pack of inventory)for(const m of pack.mods||[])knowledge.push({
  id:'mod:'+m.id,kind:'mod',title:m.name||m.id,category:'模組',
  search:clip([pack.file,m.id,m.name,m.description].filter(Boolean).join(' '),1000),
  labels:[pack.file,m.id,m.name].filter(Boolean),source:'目前整合包模組清單',playerTitle:m.name||m.id,
  playerSummary:clip([m.description,'目前安裝版本：'+(m.version||'未知'),'安裝檔：'+pack.file].filter(Boolean).join('\n'),1000)
});
const out=new URL('../data/ai/',import.meta.url);
const shardSize=220,index=[];
for(let i=0;i<knowledge.length;i+=shardSize){
  const records=knowledge.slice(i,i+shardSize);
  const file='gameplay-knowledge-'+String(index.length).padStart(2,'0')+'.json';
  fs.writeFileSync(new URL(file,out),JSON.stringify(records));
  const terms=[...new Set(records.flatMap(x=>[x.category,...(x.labels||[]),x.title]).filter(Boolean))].join(' ').slice(0,18000);
  index.push({file,count:records.length,terms});
}
fs.writeFileSync(new URL('gameplay-knowledge-index.json',out),JSON.stringify({version:1,count:knowledge.length,shards:index}));
console.log('gameplay knowledge',knowledge.length,'shards',index.length);
