import fs from 'node:fs/promises';import test from 'node:test';import assert from 'node:assert/strict';import {retrieve,tokens} from './ai-search.js';import {playerEvidence} from './ai-evidence.js';
const root=new URL('./data/ai/',import.meta.url);const read=async f=>JSON.parse(await fs.readFile(new URL(f,root),'utf8'));
test('Chinese matching uses overlapping pairs and ignores generic intents',()=>{assert(tokens('我想查魔法之眼').includes('魔法'));assert(tokens('我想查魔法之眼').includes('之眼'));assert(!tokens('在哪取得').includes('取得'))});
test('entity index retrieves both confirmed magical eye sources with readable percentages',async()=>{const m=await read('manifest.json');const facts=await retrieve(m,'魔法之眼在哪裡取得？',read);const evoker=facts.find(f=>f.source.endsWith('/entities/evoker.json')),chest=facts.find(f=>f.source.endsWith('/chests/woodland_mansion.json'));assert(evoker&&chest);assert(playerEvidence(evoker).text.includes('5%'));assert(playerEvidence(chest).text.includes('10%'));assert(!/endrem:|\.json|此池|權重/.test(playerEvidence(evoker).text));assert(m.facts>=82223)});

test('recommendations retain matching game evidence instead of exiting at the activity menu',async()=>{
 const recipe={id:'recipe',title:'鐵板製作配方',search:'鐵板 機械動力',playerSummary:'鐵錠壓成鐵板'};
 const manifest={activities:'activities.json',entityIndex:'entities.json',shards:[{file:'recipes.json',terms:'鐵板'}]};
 const pages={'activities.json':[{title:'製作燉牛肉',group:'生產',article:'food',firstStep:'準備烹飪鍋'}],'entities.json':{'鐵板':['recipes.json']},'recipes.json':[recipe]};
 const results=await retrieve(manifest,'推薦用鐵板做什麼',async f=>pages[f]);
 assert.equal(results[0].id,'recipe');
});

test('broad activity evidence preserves individual goals and their first steps',async()=>{
 const manifest={activities:'activities.json',shards:[]};
 const activities=[{title:'做一份燉牛肉',group:'生產',article:'food',firstStep:'使用烹飪鍋'}, {title:'把鐵錠壓成鐵板',group:'生產',article:'factory',firstStep:'使用動力衝壓器'}, {title:'建一個小倉庫',group:'定居',article:'storage',firstStep:'先劃出倉庫空間'}];
 const results=await retrieve(manifest,'我好無聊，做什麼好',async()=>activities);
 assert(results.some(f=>f.title==='做一份燉牛肉'&&f.playerSummary==='使用烹飪鍋'));
 assert(results.some(f=>f.title==='建一個小倉庫'));
 assert(results.every(f=>!f.playerSummary.includes('\n')));
});
test('asking for a recipe does not rank recipes using the requested product as an ingredient',async()=>{const m=await read('manifest.json');const facts=await retrieve(m,'鑽石太刀怎麼製作？',read);assert(facts[0].playerTitle.includes('鑽石太刀'));assert(facts[0].playerSummary.includes('鑽石劍 × 1'));assert(!facts.some(f=>f.playerTitle&&f.title.startsWith('製作配方')&&!f.playerTitle.includes('鑽石太刀')))});
