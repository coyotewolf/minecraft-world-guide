import fs from 'node:fs';
const base=new URL('../data/ai/',import.meta.url);
const read=file=>JSON.parse(fs.readFileSync(new URL(file,base),'utf8'));
const manifest=read('manifest.json');
const collections=JSON.parse(fs.readFileSync(new URL('../data/collections.json',import.meta.url),'utf8'));
const bosses=new Set(collections.filter(x=>x.category==='bosses').map(x=>x.id));
const names=new Map(collections.map(x=>[x.id,x.title]));
const relations=[],tableMap=new Map();let tables=0,references=0;
for(const shard of manifest.shards){
 for(const f of read(shard.file)){
  const match=f.source?.match(/^data\/([^/]+)\/loot_tables\/(.+)\.json$/);
  if(!match||f.pointer!=='$')continue;
  let data;try{data=JSON.parse(f.text)}catch{continue}
  if(!Array.isArray(data.pools))continue;
  tables++;tableMap.set(match[1]+':'+match[2],{f,data,shard:shard.file});
  const sourceId=match[1]+':'+match[2].replace(/^entities\//,'');
  const sourceType=match[2].startsWith('entities/')?'entity':match[2].startsWith('chests/')?'chest':match[2].startsWith('blocks/')?'block':'other';
  const label=id=>(f.labels||[]).find(x=>x.endsWith(' ('+id+')'))?.replace(/ \([^)]*\)$/,'')||names.get(id)||id;
  for(const pool of data.pools){
   const visit=entries=>{for(const entry of entries||[]){
    if(entry.type==='minecraft:loot_table')references++;
    if(entry.type==='minecraft:item'&&typeof entry.name==='string'){
     const simple=!data.conditions?.length&&!data.functions?.length&&!pool.conditions?.length&&!pool.functions?.length&&!entry.conditions?.length&&pool.entries?.length===1&&pool.entries[0]===entry&&pool.rolls===1&&!(entry.functions||[]).length&&(entry.weight??1)>0&&(entry.quality??0)===0&&(pool.bonus_rolls??0)===0;
     const count=(entry.functions||[]).find(x=>x.function==='minecraft:set_count')?.count??1;
     relations.push({itemId:entry.name,itemName:label(entry.name),sourceId,sourceName:names.get(sourceId)||f.playerTitle?.replace(/^擊殺|可以取得$/g,'')||sourceId,sourceType,boss:bosses.has(sourceId),detail:simple?'此掉落表每次執行必出，數量 '+count+'。':'此掉落表列出此物品；實際機率與數量需核對條件，不能假設必掉。',factId:f.id,shard:shard.file,source:f.source,jar:f.jar});
    }
    visit(entry.children);
   }};
   visit(pool.entries);
  }
 }
}
// Resolve nested loot-table references with cycle protection. Inherited pool,
// function and entry conditions are intentionally conservative, never "always".
const directRelations=relations.length,directByTable=new Map();for(const row of relations){const m=row.source.match(/^data\/([^/]+)\/loot_tables\/(.+)\.json$/);const key=m[1]+':'+m[2];if(!directByTable.has(key))directByTable.set(key,[]);directByTable.get(key).push(row)}
let resolvedReferences=0,unresolvedReferences=0;
function referenced(data){const names=[];const walk=entries=>{for(const entry of entries||[]){if(entry.type==='minecraft:loot_table'&&typeof entry.name==='string')names.push(entry.name);walk(entry.children)}};for(const pool of data.pools||[])walk(pool.entries);return names}
for(const [key,table] of tableMap){
 const rootName=key.replace(':entities/',':'),rootType=key.includes(':entities/')?'entity':key.includes(':chests/')?'chest':key.includes(':blocks/')?'block':'other';
 const visit=(reference,seen)=>{if(seen.has(reference)||seen.size>=12){unresolvedReferences++;return}const next=tableMap.get(reference);if(!next){unresolvedReferences++;return}resolvedReferences++;const path=new Set([...seen,reference]);
  for(const row of directByTable.get(reference)||[])relations.push({...row,sourceId:rootName,sourceName:names.get(rootName)||rootName,sourceType:rootType,boss:bosses.has(rootName),detail:'經引用掉落表列出此物品；需核對整條引用路徑的條件、機率與修改，不能假設必掉。',factId:table.f.id,shard:table.shard,source:table.f.source,jar:table.f.jar,via:reference});
  for(const child of referenced(next.data))visit(child,path);
 };
 for(const reference of referenced(table.data))visit(reference,new Set([key]));
}
const out={version:manifest.version,tables,relations:relations.length,directRelations,inheritedRelations:relations.length-directRelations,references,resolvedReferences,unresolvedReferences,scope:'掃描目前解包索引的直接掉落條目，並解析可找到的引用表；循環、缺少或過深的引用仍可能未解析，不含程式額外掉落、伺服器覆寫與資料包變更。',rows:relations};
fs.writeFileSync(new URL('relation-knowledge.json',base),JSON.stringify(out));
console.log('Relation knowledge:',tables,'tables,',relations.length,'entries,',references,'table references,',resolvedReferences,'resolved paths,',unresolvedReferences,'unresolved paths');
