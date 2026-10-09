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

// SLU used to expose only recipes/tags to the assistant. The actual Item
// classes contain durability, repair material, armor material and procedure
// references, so keep a compact bytecode-derived runtime map in gameplay data.
const runtimeNames={};
try{
  const nameIndex=read('data/ai/translation-registry-index.json');
  for(const file of nameIndex.shards||[])Object.assign(runtimeNames,read('data/ai/'+file));
}catch{}
function registryFieldId(field){return field?'slu:'+field.toLowerCase():''}
function runtimeSummary(id,row){
  const lines=['物品：slu:'+id,'程式類別：'+row.c];
  if(row.s)lines.push('基底類別：'+row.s);
  if(row.t){
    if(Number.isFinite(row.t.durability))lines.push('最大耐久度：'+row.t.durability);
    if(Number.isFinite(row.t.miningSpeed))lines.push('挖掘速度：'+row.t.miningSpeed);
    if(Number.isFinite(row.t.tierAttackBonus))lines.push('Tier 攻擊加成：'+row.t.tierAttackBonus);
    if(Number.isFinite(row.t.enchantability))lines.push('附魔能力：'+row.t.enchantability);
    if(row.t.repairRegistryField)lines.push('修復材料：'+registryFieldId(row.t.repairRegistryField));
  }
  if(row.a){
    const suffix=id.match(/_(helmet|chestplate|leggings|boots)$/)?.[1],slot={boots:0,leggings:1,chestplate:2,helmet:3}[suffix];
    if(slot!==undefined&&Array.isArray(row.a.baseDurabilityBySlot)&&Number.isFinite(row.a.durabilityMultiplier))lines.push('最大耐久度：'+row.a.baseDurabilityBySlot[slot]*row.a.durabilityMultiplier);
    if(slot!==undefined&&Array.isArray(row.a.defenseBySlot))lines.push('護甲值：'+row.a.defenseBySlot[slot]);
    if(Number.isFinite(row.a.enchantability))lines.push('附魔能力：'+row.a.enchantability);
    if(Number.isFinite(row.a.toughness))lines.push('韌性：'+row.a.toughness);
    if(Number.isFinite(row.a.knockbackResistance))lines.push('擊退抗性：'+row.a.knockbackResistance);
    if(row.a.repairRegistryField)lines.push('修復材料：'+registryFieldId(row.a.repairRegistryField));
  }
  if(Array.isArray(row.p)&&row.p.length)lines.push('直接呼叫程序：'+row.p.join('、'));
  return lines.join('\n');
}
try{
  const runtime=read('data/ai/slu-item-runtime-map.json');
  for(const [id,row] of Object.entries(runtime)){
    const registry='slu:'+id,name=runtimeNames[registry]||registry,summary=runtimeSummary(id,row);
    knowledge.push({
      id:'runtime:slu:item:'+id,kind:'runtime',title:name+' · 物品程式設定',category:'物品程式設定',
      search:clip([name,registry,row.c,row.s,...(row.p||[]),'耐久 durability 最大耐久 修復 repair 損壞 damage 無限耐久 unbreakable 護甲 armor 附魔 enchantability'].filter(Boolean).join(' '),1400),
      labels:[name,registry,row.c].filter(Boolean),
      source:'使用者提供的魂系 SLU JAR：net/mcreator/slu/item/'+row.c+'.class',
      playerTitle:name+' 的程式設定',playerSummary:summary,runtimeEvidence:true,
      retrievalText:summary,retrievalScope:'直接由目前 SLU JAR 的 Item class bytecode 與其 Tier／ArmorMaterial 實作整理；程序造成的額外效果需再查被呼叫的 procedure。'
    });
  }
}catch(error){console.warn('SLU runtime item map unavailable:',error.message)}

// Complete, checked runtime mechanics are retained as readable evidence.
for(const fact of read('data/ai/monsterexpansion-runtime-verified.json'))knowledge.push(fact);

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
