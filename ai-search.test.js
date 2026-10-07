import fs from 'node:fs/promises';import test from 'node:test';import assert from 'node:assert/strict';import {retrieve,tokens} from './ai-search.js';import {playerEvidence} from './ai-evidence.js';
import {retrieveMany} from './ai-search.js';
import {modelEvidence} from './ai-evidence.js';
import {resolveSubjects} from './subject-resolver.js';

test('typed aliases resolve books to enchantments, preserve collisions, and avoid item-name substrings',()=>{
 const records=[{id:'pack:volume',type:'enchantment',name:'擴充',aliases:['容量','Capacity']},{id:'other:volume',type:'enchantment',name:'容量',aliases:['Capacity']},{id:'spell:volume',type:'effect',name:'容量',aliases:['Capacity']}];
 assert.deepEqual(resolveSubjects({records},'容量 附魔書有什麼用').map(r=>r.id),['pack:volume','other:volume']);
 assert.equal(resolveSubjects({records},'Capacity 附魔書').length,2);
 assert.equal(resolveSubjects({records},'capacity_card 材料').length,0);
 assert.equal(resolveSubjects({records},'法術書的容量').length,0);
});

test('installed enchantment aliases retrieve capacity mechanics instead of spell-book storage',async()=>{
 for(const query of ['容量 附魔書可以做什麼','容量附魔書有啥用','附魔書「容量」是幹嘛的','擴充附魔最高幾級','Capacity 附魔效果']){
  const manifest=await read('manifest.json'),result=await retrieveMany(manifest,[query],read);
  assert.equal(result.facts[0].registrySubject.id,'create:capacity',query);
  assert(result.facts[0].playerSummary.includes('正常最高 III'));
  assert(result.facts[0].playerSummary.includes('Northstar'));
  assert(result.coverage.resolvedSubjects.some(r=>r.type==='enchantment'&&r.id==='create:capacity'));
  assert(!result.facts.some(f=>f.source?.includes('iss_guide_book')),query);
  assert(result.coverage.readShards<=16);
 }
});

test('an unfamiliar typed subject locates its definition and cross-mod runtime without generic book anchors',async()=>{
 const row={id:'pack:echo',type:'enchantment',name:'迴響',aliases:['回音','Echo'],description:'增加裝備回音範圍。',source:'pack.jar!lang/zh_tw.json',refs:[{file:'runtime',factId:'handler'}]};
 const manifest={subjectRegistry:'typed',shards:[{file:'runtime',terms:'EchoEnchantment',kinds:['行為']},{file:'manual',terms:'附魔書 法術書',kinds:['手冊']}]};
 const pages={typed:{records:[row]},'coverage-index.json':{subjects:{'附魔書':[['manual',['手冊']]]}},runtime:[{id:'handler',title:'模組行為 · EchoHandler',text:'EchoEnchantment.canApplyAtEnchantingTable',search:'EchoEnchantment',runtimeEvidence:true}],manual:[{id:'wrong',title:'附魔書',search:'附魔書',text:'不相關的卷軸'}]};
 const result=await retrieveMany(manifest,['回音 附魔書可以做什麼'],async f=>pages[f]);
 assert.equal(result.facts[0].registrySubject.id,'pack:echo');assert(result.facts.some(f=>f.id==='handler'));assert(!result.facts.some(f=>f.id==='wrong'));
});

test('installed typed lookup also supports unrelated mod enchantments and status-effect wording',async()=>{
 for(const [query,id,text] of [['雲端之上 附魔书有什麼效果','create_sa:above_the_clouds','無限制'],['霜寒附魔書有什麼用','northstar:frostbite','冰凍傷害'],['失明效果是什麼','minecraft:blindness','名稱']]){
  const result=await retrieveMany(await read('manifest.json'),[query],read);
  assert.equal(result.facts[0].registrySubject.id,id,query);assert(result.facts[0].playerSummary.includes(text));
 }
});

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


test('routine evidence keeps nested success and rejection branches across arbitrary topics',async()=>{
 const {routineExcerpt}=await import('./evidence-integrity.js');
 const source='public Result handleActivate(){\n String json="{not a block}"; /* } */\n if (!powered) { return FAIL; }\n if (fuel > 0 && enabled) { useFuel(); return SUCCESS; }\n return PASS;\n}\npublic void unrelated() { explode(); }';
 const r=routineExcerpt(source);assert(r.complete);assert(r.text.includes('return FAIL'));assert(r.text.includes('fuel > 0 && enabled'));assert(r.text.endsWith('}'));assert(!r.text.includes('unrelated'));
});
test('over-budget and incomplete functions explicitly disclose missing conditions rather than appearing complete',async()=>{
 const {routineExcerpt}=await import('./evidence-integrity.js');
 const raw='public void process(){\n'+('doWork();\n'.repeat(600))+'if (!safe) { return; }\n}';const r=routineExcerpt(raw,0,800);assert(!r.complete);assert(r.text.includes('條件可能不完整'));assert(r.text.includes('if (!safe)'));
 const partial=routineExcerpt('public void handleUse(){ if(!valid) { return; }');assert(!partial.complete);assert(partial.reason.includes('未包含函式結尾'));
});

test('referenced settings are discovered before answering across crafting, logistics, combat and unfamiliar mechanics',async()=>{
 const {referenceQueries}=await import('./ai-search.js');
 for(const [query,method,field] of [['合成條件','handleCraft','requiredIngredients'],['自動輸送','handleTransfer','insertLimit'],['射擊條件','handleFire','projectileSpeed'],['未知機器數值','operate','rareThreshold']]){
  const runtime={runtimeEvidence:true,text:'public Result '+method+'(){ if(!enabled) return FAIL; if(value >= DeviceConfig.'+field+') return SUCCESS; return PASS; }'};
  assert(referenceQueries([runtime],query).some(q=>q.includes('DeviceConfig.'+field)),query);
 }
});

test('model evidence preserves distinct installed item identities even when translations share the same display name',async()=>{
 const {localizeModelEvidence}=await import('./ai-evidence.js');
 const r=localizeModelEvidence('ingredient=pack:red_token; result=pack:blue_token',text=>text.replace(/pack:(?:red|blue)_token/g,'憑證'));
 assert(r.includes('憑證（pack:red_token）'));assert(r.includes('憑證（pack:blue_token）'));assert(!r.includes('\uE000'));
});

test('dependency follow-up is not restricted to classes named Config and ignores library plumbing',async()=>{
 const {referenceQueries}=await import('./ai-search.js');
 for(const ref of ['MachineSettings.requiredFuel','ModTags.Blocks.HEAT_SOURCES','RecipeRules.requiredTool','CreatureOptions.allowedFoods']){
  const r=referenceQueries([{runtimeEvidence:true,text:'public void handleUse(){ Math.max(1,2); if(ok) check('+ref+'); InteractionResult.SUCCESS; }'}],'操作條件');
  assert(r.some(q=>q.includes(ref)));assert(!r.some(q=>q.includes('Math.max')||q.includes('InteractionResult.SUCCESS')));
 }
});
