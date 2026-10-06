import fs from 'node:fs';
const base=new URL('../data/ai/',import.meta.url);
const read=file=>JSON.parse(fs.readFileSync(new URL(file,base),'utf8'));
const manifest=read('manifest.json');
const collections=JSON.parse(fs.readFileSync(new URL('../data/collections.json',import.meta.url),'utf8'));
const bosses=new Set(collections.filter(x=>x.category==='bosses').map(x=>x.id));
const names=new Map(collections.map(x=>[x.id,x.title]));
const relations=[];let tables=0,references=0;
for(const shard of manifest.shards){
 for(const f of read(shard.file)){
  const match=f.source?.match(/^data\/([^/]+)\/loot_tables\/(.+)\.json$/);
  if(!match||f.pointer!=='$')continue;
  let data;try{data=JSON.parse(f.text)}catch{continue}
  if(!Array.isArray(data.pools))continue;
  tables++;
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
const out={version:manifest.version,tables,relations:relations.length,references,scope:'完整掃描目前解包索引的直接掉落條目；不含未解析的引用表、程式額外掉落、伺服器覆寫與資料包變更。',rows:relations};
fs.writeFileSync(new URL('relation-knowledge.json',base),JSON.stringify(out));
console.log('Relation knowledge:',tables,'tables,',relations.length,'direct entries,',references,'table references');
