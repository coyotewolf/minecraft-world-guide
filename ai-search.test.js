import fs from 'node:fs/promises';import test from 'node:test';import assert from 'node:assert/strict';import {retrieve,tokens} from './ai-search.js';import {playerEvidence} from './ai-evidence.js';
import {retrieveMany} from './ai-search.js';
import {modelEvidence} from './ai-evidence.js';

test('reference follow-up finds related configuration definitions beyond shortened search text',async()=>{
 const manifest={shards:[{file:'actor',terms:'試驗獸 馴服',ids:['test'],kinds:['馴服與餵食']},{file:'config',terms:'設定',ids:['test'],kinds:['模組資料']}]};
 const text='// unrelated header\n'.repeat(150)+'public List<String> testFoods = List.of("test:specific_food");\n';
 const pages={'coverage-index.json':{files:[['actor',[]],['config',[]]],subjects:{'試驗獸':[0]},codeLookup:{t:'lookup'}},lookup:{testfoods:[1]},actor:[{id:'actor',title:'馴服與餵食 · 試驗獸',search:'試驗獸 馴服 testFoods',runtimeEvidence:true,text:'Requires testFoods;'}],config:[{id:'config',title:'模組資料 · 設定',search:text.slice(0,1000),runtimeEvidence:true,text}]};
 const r=await retrieveMany(manifest,['試驗獸 馴服 testFoods'],async f=>pages[f],{related:true});assert.equal(r.facts[0].id,'config');assert(modelEvidence(r.facts[0]).text.includes('test:specific_food'));assert.equal(r.facts[0].text,text);
});
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

test('multi-source lookup keeps exact product recipes, behavioral evidence and secondary queries',async()=>{
 const manifest={shards:[{file:'recipe',terms:'試驗獸 甲片',kinds:['製作配方']},{file:'behavior',terms:'試驗獸 餵食',kinds:['馴服與餵食']},{file:'wrong',terms:'舊龍 餵食',kinds:['馴服與餵食']} ]};
 const files={'coverage-index.json':{subjects:{'試驗獸':[['recipe',['製作配方']],['behavior',['馴服與餵食']]]}},recipe:[{id:'recipe',title:'製作配方 · 試驗獸甲片',search:'試驗獸 甲片'}],behavior:[{id:'behavior',title:'馴服與餵食 · 試驗獸',search:'試驗獸 餵食'}],wrong:[{id:'wrong',title:'舊龍',search:'舊龍'}]};const reads=[];
 const result=await retrieveMany(manifest,['試驗獸 甲片','試驗獸 餵食'],async f=>{reads.push(f);return files[f]});assert(result.facts.some(f=>f.id==='behavior'));assert(result.facts.some(f=>f.id==='recipe'));assert(!result.facts.some(f=>f.id==='wrong'));assert.equal(reads.filter(f=>f==='behavior').length,1);assert.equal(result.coverage.bounded,true);
});
test('retrieval remains bounded across many related shards while balancing kinds',async()=>{
 const manifest={shards:Array.from({length:40},(_,i)=>({file:'s'+i,terms:'測試主題',kinds:[i<35?'配方':'行為']}))};const subjects={'測試主題':manifest.shards.map(s=>[s.file,s.kinds])};let reads=0;
 const result=await retrieveMany(manifest,['測試主題'],async file=>file==='coverage-index.json'?{subjects}:(reads++,[{id:file,title:'測試主題',search:'測試主題'}]));assert.equal(reads,16);assert(result.coverage.evidenceKinds.includes('行為'));assert.equal(result.coverage.matchedShards,40);
});
test('installed data multi-query recipe answers do not pick an upgrade that consumes the named item',async()=>{const m=await read('manifest.json');const r=await retrieveMany(m,['鑽石太刀怎麼製作？'],read);const recipes=r.facts.filter(f=>f.title.startsWith('製作配方')&&f.playerTitle);assert(recipes.length);assert(recipes.every(f=>f.playerTitle.includes('鑽石太刀')));assert(r.facts[0].playerSummary.includes('鑽石劍 × 1'))});
