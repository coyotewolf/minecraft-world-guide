import test from 'node:test';import assert from 'node:assert/strict';
import {GuideService,selectedFacts,approvedUser,providerAnswer,providerFailure,providerMessages,dayKey,questionBody} from './core.js';
import {validIntent,relationEvidence} from './conversation-intent.js';
class Store{constructor(){this.values=new Map();this.queue=Promise.resolve()}async get(k){return structuredClone(this.values.get(k))}async put(k,v){this.values.set(k,structuredClone(v))}async delete(keys){for(const key of keys)this.values.delete(key)}async list({prefix,limit,startAfter=''}){return new Map([...this.values].filter(([k])=>k.startsWith(prefix)&&k>startAfter).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit))}transaction(fn){const p=this.queue.then(()=>fn(this));this.queue=p.catch(()=>{});return p}}
const fact={id:'test-id',title:'魔法之眼',search:'魔法之眼',text:'森林豪宅寶箱',labels:[],shard:'one.json'};
function setup(){const storage=new Store(),env={FREE_ONLY_ACK:'true',AI:{run:async()=>({response:{answer:'這是根據資料整理的回答。',factIds:['1']}})},ASSETS:{fetch:async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[{file:'one.json',terms:'魔法之眼'}]}:[fact])}};return {storage,env,service:new GuideService(storage,env)}}
const trophyPlan={query:'首領 獎盃 掉落',mode:'list',facet:'bossDrops',focus:['獎盃','trophy'],useHistory:false,progress:'advanced',exclude:[]};
const trophyCatalog={references:2,scope:'測試資料的直接掉落表，不含伺服器覆寫',rows:['契瑟德','蓋布拉','馬爾庫特'].map((name,i)=>({itemName:name+'獎盃',itemId:'test:'+i+'_trophy',sourceName:name,sourceId:'test:'+i,boss:true,detail:'此掉落表每次執行必出，數量 1。'}))};

test('an evidence gap still reaches chat AI with explicit bounded scope instead of a fixed fallback',async()=>{
 const {service,env}=setup();env.CONVERSATION_PLANNER='true';env.ASSETS.fetch=async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[]}:[]);let calls=0;
 env.AI.run=async(_,input)=>{if(++calls===1)return {response:{...trophyPlan,query:'找不到名字的機器 啟動',mode:'mechanism',facet:'none',focus:[]}};const context=JSON.parse(input.messages.at(-1).content.replace(/\n\/no_think$/,''));assert.equal(context.facts.length,0);assert.equal(context.retrievalCoverage.bounded,true);return {response:{answer:'這台機器的名字還沒確認，你看到的介面標題是什麼？',factIds:[]}}};
 const result=await service.ask('u','那個機器啟動不了');assert.equal(calls,2);assert.equal(result.body.answer,'這台機器的名字還沒確認，你看到的介面標題是什麼？');
});

test('recommendation review receives evidence and corrects a generic draft without charging a second question',async()=>{
 const {service,env,storage}=setup();env.CONVERSATION_PLANNER='true';env.ANSWER_REVIEW='true';let calls=0;
 env.AI.run=async(_,input)=>{calls++;if(calls===1)return {response:{...trophyPlan,mode:'recommendation',facet:'none',query:'魔法之眼',focus:[]}};if(calls===2)return {response:{answer:'挑一種材料做產線。',factIds:['1']}};const p=JSON.parse(input.messages.at(-1).content.replace(/\n\/no_think$/,''));assert.equal(p.draft.answer,'挑一種材料做產線。');assert(p.facts[0].text);return {response:{answer:'這次就去收藏魔法之眼，先查森林豪宅寶箱。',factIds:['1']}}};
 const result=await service.ask('u','給我一個目標');assert.equal(calls,3);assert.equal(result.body.answer,'這次就去收藏魔法之眼，先查森林豪宅寶箱。');assert.equal(await storage.get('user:'+dayKey()+':u'),1);
});

test('drop lookup supports source-to-items as well as item-to-sources without assuming conditional reference drops',()=>{
 const rows=[...trophyCatalog.rows,{itemName:'特殊晶石',itemId:'test:crystal',sourceName:'馬爾庫特',sourceId:'test:2',boss:true,detail:'經引用表列出；不能假設必掉。'}];
 const bySource=relationEvidence({...trophyCatalog,rows},{...trophyPlan,focus:['馬爾庫特'],relationSide:'source'});assert.equal(bySource.lookup.matches,2);assert.match(bySource.playerSummary,/特殊晶石/);assert.match(bySource.playerSummary,/不能假設必掉/);
 const byItem=relationEvidence({...trophyCatalog,rows},{...trophyPlan,focus:['獎盃'],relationSide:'item'});assert.equal(byItem.lookup.matches,3);assert(!byItem.playerSummary.includes('特殊晶石'));
});

test('named acquisition retains runtime evidence even when the creature is missing from companion cards',async()=>{
 const {service,env}=setup();env.CONVERSATION_PLANNER='true';let calls=0;
 const pages={'manifest.json':{version:'v1',shards:[{file:'runtime.json',terms:'試驗獸 馴服',kinds:['馴服與餵食']}]},'coverage-index.json':{subjects:{'試驗獸':[['runtime.json',['馴服與餵食']]]}},'runtime.json':[{id:'runtime',title:'馴服與餵食 · 試驗獸',search:'試驗獸 tame isFood',runtimeEvidence:true,text:'isFood = test_seed; mustSneak = true;'}],'player-playbook.json':[],'gameplay-knowledge-index.json':{shards:[{file:'cards.json'}]},'cards.json':[{id:'generic',kind:'collection',category:'companions',title:'普通生物',search:'夥伴 馴服',playerSummary:'不能替代點名的生物'}]};
 env.ASSETS.fetch=async r=>Response.json(pages[r.url.split('/').at(-1)]||[]);
 env.AI.run=async(_,input)=>{if(++calls===1)return {response:{...trophyPlan,query:'試驗獸 怎麼馴服',mode:'acquisition',facet:'companions',focus:['試驗獸']}};const x=JSON.parse(input.messages.at(-1).content.replace(/\n\/no_think$/,''));assert(x.facts.some(f=>f.text.includes('mustSneak')));assert(!x.facts.some(f=>f.title==='普通生物'));return {response:{answer:'拿指定種子蹲下互動。',factIds:['1']}}};
 assert.equal((await service.ask('u','試驗獸怎麼馴服')).body.answer,'拿指定種子蹲下互動。');
});

test('review can request one bounded evidence supplement and still consumes only one player question',async()=>{
 const {service,env,storage}=setup();env.CONVERSATION_PLANNER='true';env.ANSWER_REVIEW='true';let calls=0;
 env.AI.run=async(_,input)=>{calls++;if(calls===1)return {response:{...trophyPlan,query:'魔法之眼',mode:'mechanism',facet:'none',focus:[]}};if(calls===2)return {response:{answer:'還要核對條件。',factIds:['1']}};const x=JSON.parse(input.messages.at(-1).content.replace(/\n\/no_think$/,''));if(calls===3){assert.equal(x.searchBudgetRemaining,1);return {response:{answer:'先補查定義。',factIds:['1'],searchQueries:['魔法之眼 條件']}}}assert.equal(x.searchBudgetRemaining,0);assert(x.retrievalCoverage.supplemental);return {response:{answer:'已核對目前能確認的條件。',factIds:['1']}}};
 const result=await service.ask('u','魔法之眼的條件');assert.equal(calls,4);assert.equal(result.status,200);assert.equal(await storage.get('user:'+dayKey()+':u'),1);
});

test('cold-start installed knowledge and referenced defaults stay within the asset request budget',async()=>{
 const fs=await import('node:fs/promises'),storage=new Store(),counts=new Map();let calls=0;
 const env={FREE_ONLY_ACK:'true',CONVERSATION_PLANNER:'true',ANSWER_REVIEW:'true',ASSETS:{fetch:async r=>{const file=r.url.split('/').at(-1);counts.set(file,(counts.get(file)||0)+1);try{return Response.json(JSON.parse(await fs.readFile(new URL('../data/ai/'+file,import.meta.url),'utf8')))}catch{return new Response('',{status:404})}}},AI:{run:async(_,input)=>{if(++calls===1)return {response:{...trophyPlan,query:'倉鼠 馴服 食物',mode:'acquisition',facet:'companions',focus:['倉鼠']}};if(calls===2)return {response:{answer:'先核對食物。',factIds:['1']}};const x=JSON.parse(input.messages.at(-1).content.replace(/\n\/no_think$/,''));assert.equal(x.searchBudgetRemaining,0);assert(x.facts.some(f=>f.text.includes('sliced_cucumber')||f.text.includes('黃瓜')));assert(x.facts.some(f=>f.text.includes('if (isSneaking && isTamingFood)')));return {response:{answer:'已補查到具體食物。',factIds:['1'],searchQueries:[]}}}}};
 const service=new GuideService(storage,env),result=await service.ask('u','倉鼠要餵什麼才能馴服？');assert.equal(result.status,200);assert.equal(calls,3);assert(counts.size<=40);assert([...counts.values()].every(n=>n===1));assert.equal(service.requestReads,null);
});

test('semantic plan resolves the current list and does not reuse old dragon evidence',async()=>{
 const {service,env,storage}=setup();env.CONVERSATION_PLANNER='true';let calls=0,answerInput;
 env.ASSETS.fetch=async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[]}:r.url.endsWith('relation-knowledge.json')?trophyCatalog:r.url.endsWith('player-playbook.json')?[{id:'dragon',title:'安全的龍',search:'龍 安全 會飛 獎盃',category:'dragon-behavior',playerSummary:'不要混入清單'}]:[]);
 env.AI.run=async(_,input)=>{calls++;if(calls===1){assert(input.max_tokens<700);assert(input.messages.some(m=>m.content.includes('龍')));return {response:trophyPlan}}answerInput=JSON.parse(input.messages.at(-1).content.replace(/\n\/no_think$/,''));return {response:{answer:'契瑟德、蓋布拉、馬爾庫特。',factIds:['1']}}};
 const result=await service.ask('u','欸我記得打王有獎盃？哪些王有獎盃？',undefined,[{user:'有哪些能飛的龍',assistant:'先看龍。'}]);
 assert.equal(result.status,200);assert.equal(calls,2);assert.equal(await storage.get('user:'+dayKey()+':u'),1);
 assert(answerInput.facts[0].text.includes('契瑟德'));assert(answerInput.facts[0].text.includes('蓋布拉'));assert(answerInput.facts[0].text.includes('馬爾庫特'));
 assert(!answerInput.facts.some(f=>f.title==='安全的龍'));assert.equal(answerInput.requestedConstraints.flying,false);
});

test('other bosses follow-up can exclude the previous example while listing named matches',()=>{
 const evidence=relationEvidence(trophyCatalog,{...trophyPlan,useHistory:true,exclude:['馬爾庫特']});
 assert(evidence.playerSummary.includes('契瑟德'));assert(evidence.playerSummary.includes('蓋布拉'));assert(!evidence.playerSummary.includes('馬爾庫特 →'));assert.equal(evidence.lookup.matches,3);
 assert.equal(relationEvidence({...trophyCatalog,rows:[]},trophyPlan).lookup.matches,0);
});

test('invalid semantic output is rejected and a spent-out player cannot invoke planning',async()=>{
 assert(validIntent(trophyPlan));assert(!validIntent({...trophyPlan,query:''}));assert(!validIntent({...trophyPlan,focus:['x'.repeat(41)]}));
 const {service,env,storage}=setup();env.CONVERSATION_PLANNER='true';env.AI.run=()=>assert.fail('must check cap before planning');await storage.put('user:'+dayKey()+':u',50);
 assert.equal((await service.ask('u','其他的呢')).status,429);
});

test('cached semantic plan and answer avoid repeated provider work',async()=>{
 const {service,env}=setup();env.CONVERSATION_PLANNER='true';let calls=0;
 env.AI.run=async()=>({response:++calls===1?{...trophyPlan,query:'魔法之眼',facet:'none',mode:'mechanism'}:{answer:'森林豪宅寶箱。',factIds:['1']}});
 await service.ask('u','魔法之眼');await service.ask('u','魔法之眼');assert.equal(calls,2);
});

test('failed planner refunds the question and does not reach answer generation',async()=>{
 const {service,env,storage}=setup();env.CONVERSATION_PLANNER='true';env.AI.run=async()=>({response:{unexpected:true}});
 const result=await service.ask('u','哪些王有獎盃');assert.equal(result.status,503);assert.equal(await storage.get('user:'+dayKey()+':u'),0);assert.equal(await storage.get('global:'+dayKey()),0);
});

test('capture request prioritizes companion acquisition conditions over passive ride instructions',async()=>{
 const {service,env}=setup();env.CONVERSATION_PLANNER='true';let calls=0,input;
 env.ASSETS.fetch=async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[]}:r.url.endsWith('gameplay-knowledge-index.json')?{shards:[{file:'companions.json'}]}:r.url.endsWith('companions.json')?[{id:'collection:dragon',category:'companions',kind:'collection',title:'特殊夥伴',search:'馴服 特殊 生物',playerSummary:'野生取得地點：雷暴期間；成年須戰鬥壓制後餵食生羊肉。'}]:r.url.endsWith('player-playbook.json')?[{id:'ride',category:'dragon-behavior',title:'上龍操作',search:'特殊 馴服 生物',playerSummary:'主手不拿食物可以上龍。'}]:[]);
 env.AI.run=async(_,value)=>{calls++;if(calls===1)return {response:{...trophyPlan,query:'特殊生物 馴服',facet:'companions',mode:'acquisition',focus:['馴服']}};input=JSON.parse(value.messages.at(-1).content.replace(/\n\/no_think$/,''));return {response:{answer:'雷暴期間找野生個體，壓制後餵食。',factIds:['1']}}};
 await service.ask('u','都不想，有什麼特殊的東西可以抓嗎');assert(input.facts[0].text.includes('戰鬥壓制後餵食'));assert(!input.facts.some(f=>f.title==='上龍操作'));
});

test('creature behavior question still retains checked building risk evidence',async()=>{
 const {service,env}=setup();env.CONVERSATION_PLANNER='true';let calls=0,input;
 env.ASSETS.fetch=async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[]}:r.url.endsWith('player-playbook.json')?[{id:'safety',category:'dragon-behavior',title:'蓑鮋龍的建築安全',search:'蓑鮋龍 原木 建築安全',playerSummary:'拆相連原木，不區分玩家放置；木屋不能保證安全。'}]:[]);
 env.AI.run=async(_,value)=>{calls++;if(calls===1)return {response:{...trophyPlan,query:'蓑鮋龍 原木 建築安全',facet:'companions',mode:'mechanism',focus:['原木']}};input=JSON.parse(value.messages.at(-1).content.replace(/\n\/no_think$/,''));return {response:{answer:'原木房屋不能保證安全。',factIds:['1']}}};
 await service.ask('u','蓑鮋龍放原木房子旁邊安全嗎');assert(input.facts.some(f=>f.text.includes('不區分玩家放置')));
});

test('compact conversation state preserves progress beyond recent transcript while allowing topic changes',async()=>{
 const {service,env,storage}=setup(),cid='00000000-0000-4000-8000-000000000008';env.CONVERSATION_PLANNER='true';let calls=0;
 await storage.put('conversation:u:'+cid,{expires:Date.now()+86400000,questions:['找會飛的龍'],answers:['比較坐騎。'],context:'龍',intent:{...trophyPlan,query:'會飛又能騎的龍',facet:'companions',mode:'recommendation'}});
 env.ASSETS.fetch=async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[]}:r.url.endsWith('relation-knowledge.json')?trophyCatalog:[]);
 env.AI.run=async(_,value)=>{calls++;if(calls===1){const input=JSON.parse(value.messages.at(-1).content.replace(/\n\/no_think$/,''));assert.equal(input.priorIntent.progress,'advanced');assert(input.priorIntent.query.includes('會飛'));return {response:trophyPlan}}return {response:{answer:'契瑟德、蓋布拉、馬爾庫特。',factIds:['1']}}};
 const result=await service.ask('u','哪些王有獎盃',cid,Array.from({length:8},()=>({user:'其他內容',assistant:'接著聊。'})));
 assert.equal(result.intent,undefined);assert.equal(result.body.intent.useHistory,false);assert.equal((await storage.get('conversation:u:'+cid)).intent.facet,'bossDrops');
});
test('only exact supplied facts are returned; fabricated IDs reject the response',()=>{assert.deepEqual(selectedFacts('{"factIds":["unknown"]}',[fact]),[]);assert.deepEqual(selectedFacts({factIds:['test-id','test-id']},[fact]),[fact]);assert.deepEqual(selectedFacts('<script>bad</script>',[fact]),[])});
test('approved account check requires active RPC status',async()=>{const request=new Request('https://test',{headers:{Authorization:'Bearer fake'}}),env={SUPABASE_URL:'https://sb',SUPABASE_KEY:'public'};let calls=0;assert.equal(await approvedUser(request,env,async()=>Response.json(++calls===1?{id:'u'}:{active:false})),null);calls=0;assert.equal(await approvedUser(request,env,async()=>Response.json(++calls===1?{id:'u'}:{active:true})),'u')});
test('Gemini quota failure falls back to Cloudflare',async()=>{let fallback=0;const spent=[];const result=await providerAnswer({GEMINI_API_KEY:'not-real',AI:{run:async()=>{fallback++;return {response:{answer:'這是根據資料整理的回答。',factIds:['1']}}}}},'prompt',async()=>true,async(...args)=>spent.push(args),async()=>new Response('{}',{status:429}));assert.equal(result.provider,'cloudflare');assert.equal(fallback,1);assert(spent.some(x=>x[0]==='gemini'&&x[1]===60000))});
test('no allowed provider returns unavailable without paid route',async()=>{assert.equal(await providerAnswer({AI:{run:()=>assert.fail()}},'prompt',async()=>false,async()=>{}),null)});

test('both providers receive actual conversation roles and separate current evidence',async()=>{
 const prompt='聊天規則\n'+JSON.stringify({priorTurns:[{user:'想放鬆',assistant:'蓋個小倉庫吧。'}],question:'不要蓋東西，換一個',facts:[{id:'1',text:'烹飪鍋'}]});
 const messages=providerMessages(prompt);
 assert.deepEqual(messages.map(m=>m.role),['system','user','assistant','user']);
 assert.equal(messages[2].content,'蓋個小倉庫吧。');assert(!messages[3].content.includes('priorTurns'));
 let primary,fallback;
 await providerAnswer({gemini_api:'test-only'},prompt,async()=>true,async()=>{},async(_,options)=>{primary=JSON.parse(options.body);return Response.json({candidates:[{content:{parts:[{text:'ok'}]}}]})});
 assert.equal(primary.systemInstruction.parts[0].text,'聊天規則');assert.deepEqual(primary.contents.map(m=>m.role),['user','model','user']);
 await providerAnswer({AI:{run:async(_,input)=>{fallback=input;return {response:'ok'}}}},prompt,async()=>true,async()=>{});
 assert.deepEqual(fallback.messages.map(m=>m.role),['system','user','assistant','user']);
});

test('provider diagnostics distinguish daily quota, short limits and configuration without raw errors',()=>{
 assert.deepEqual(providerFailure(429,{error:{details:[{violations:[{quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]},{retryDelay:'3720s'}]}}),{code:'daily_quota',status:429,delay:3720000});
 assert.equal(providerFailure(429,{error:{details:[{retryDelay:'9s'}]}}).delay,9000);
 assert.equal(providerFailure(403,{error:{message:'private-key-never-store'}}).code,'configuration');
 assert(!JSON.stringify(providerFailure(403,{error:{message:'private-key-never-store'}})).includes('private-key'));
});
test('invalid primary output falls back instead of pretending knowledge is missing',async()=>{
 const failures=[];const result=await providerAnswer({GEMINI_API_KEY:'test-only',AI:{run:async()=>({response:'{"answer":"有依據的回答","factIds":["1"]}'})}},'prompt',async()=>true,async()=>{},async()=>Response.json({candidates:[{content:{parts:[{text:'truncated {'}]}}]}),async(p,f)=>failures.push(f.code),v=>{try{return !!JSON.parse(v).answer}catch{return false}});
 assert.equal(result.provider,'cloudflare');assert.deepEqual(failures,['invalid_answer']);
});
test('cloud transcript restores constraints after worker conversation expiry',async()=>{
 const {service,env}=setup();let prompt='';env.AI.run=async(_,input)=>{prompt=input.messages.map(m=>m.content).join('\n');return {response:{answer:'保留會飛條件。',factIds:['1']}}};
 await service.ask('u','魔法之眼','00000000-0000-4000-8000-000000000003',[{user:'找會飛又能騎的龍',assistant:'先比較地形效果。'}]);
 assert.match(prompt,/找會飛又能騎的龍/);
});

test('new topic evidence is not crowded out by flight and building constraints from old turns',async()=>{
 const {service,env}=setup();let input;
 const dragons=Array.from({length:8},(_,i)=>({id:'dragon-'+i,category:'dragon-behavior',title:'會飛能騎的龍 '+i,search:'龍 飛行 原木建築 建築安全',playerSummary:'相連原木有風險'}));
 const food={id:'food',category:'cooking',title:'燉牛肉',search:'燉牛肉 料理 製作',playerSummary:'使用烹飪鍋'};
 env.ASSETS.fetch=async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[{file:'food.json',terms:'燉牛肉'}]}:r.url.endsWith('player-playbook.json')?dragons:r.url.endsWith('food.json')?[food]:[]);
 env.AI.run=async(_,value)=>{input=JSON.parse(value.messages.map(m=>m.content).join('\n').split('\n').find(line=>line.startsWith('{')));return {response:{answer:'燉牛肉使用烹飪鍋。',factIds:['1']}}};
 const result=await service.ask('u','換個話題，燉牛肉怎麼做？',undefined,[{user:'推薦會飛能騎又不破壞原木建築的龍',assistant:'比較飛行坐騎。'}]);
 assert.equal(input.facts[0].title,'燉牛肉');assert.equal(result.body.facts[0].id,'food');
});

test('conversational replies without citations still remain in the next turn memory',async()=>{
 const {service,env,storage}=setup(),cid='00000000-0000-4000-8000-000000000007';let input;
 env.AI.run=async(_,value)=>{input=value.messages.map(m=>m.content).join('\n');return {response:{answer:'那我們先聊魔法之眼吧。',factIds:[]}}};
 await service.ask('u','魔法之眼',cid);
 assert.equal((await storage.get('conversation:u:'+cid)).answers[0],'那我們先聊魔法之眼吧。');
 await service.ask('u','魔法之眼還有呢？',cid);
 assert(input.includes('那我們先聊魔法之眼吧。'));
});

test('unnamed conversation gets concrete activity evidence without matching recommendation keywords',async()=>{
 const {service,env}=setup();let input;
 env.ASSETS.fetch=async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',activities:'activities.json',shards:[]}:r.url.endsWith('activities.json')?[{title:'製作揹包',article:'backpack',group:'起步',firstStep:'線 ×4、皮革 ×4、木箱 ×1'}]:[]);
 env.AI.run=async(_,value)=>{input=JSON.parse(value.messages.at(-1).content.replace(/\n\/no_think$/,''));return {response:{answer:'做個揹包吧。',factIds:['1']}}};
 const result=await service.ask('u','你替我拿主意好了');
 assert.equal(result.status,200);assert(input.facts.some(f=>f.text.includes('皮革 ×4')));
});

test('activity titles are backed by full instructions rather than just the opening step',async()=>{
 const {service,env}=setup();let input;
 env.ASSETS.fetch=async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',activities:'activities.json',shards:[]}:r.url.endsWith('activities.json')?[{title:'切菜板與烹飪鍋：做燉牛肉',article:'food',group:'生產',firstStep:'放下切菜板'}]:r.url.endsWith('gameplay-knowledge-index.json')?{shards:[{file:'gameplay.json'}]}:r.url.endsWith('gameplay.json')?[{id:'article:food',kind:'article',title:'燉牛肉',playerSummary:'烹飪鍋下方提供熱源，生牛肉 ×1、紅蘿蔔 ×1、馬鈴薯 ×1；成品需要碗。',source:'已查核教學'}]:[]);
 env.AI.run=async(_,value)=>{input=JSON.parse(value.messages.at(-1).content.replace(/\n\/no_think$/,''));return {response:{answer:'使用烹飪鍋做燉牛肉。',factIds:['1']}}};
 await service.ask('u','幫我決定一件事');
 const activity=input.facts.find(f=>f.title.includes('切菜板'));
 assert(activity.text.includes('烹飪鍋下方提供熱源'));assert(activity.text.includes('成品需要碗'));
});
test('all providers cooling down produces retry time, not a missing-data answer',async()=>{
 const {service,storage}=setup();await storage.put('cooldown:cloudflare',Date.now()+60000);const r=await service.ask('u','魔法之眼');assert.equal(r.status,503);assert(r.body.retryAt>Date.now());assert.match(r.body.error,/重試/);assert.equal(await storage.get('user:'+dayKey()+':u'),0);
});
test('existing gemini_api secret alias uses Gemini without exposing the secret',async()=>{const result=await providerAnswer({gemini_api:'test-only'},'prompt',async()=>true,async()=>{},async(url,options)=>{assert.equal(options.headers['x-goog-api-key'],'test-only');return Response.json({candidates:[{content:{parts:[{text:'{"factIds":["test-id"]}'}]}}]})});assert.equal(result.provider,'gemini');assert.equal(selectedFacts(result.value,[fact]).length,1)});
test('successful answer, cache, user cap and site cap',async()=>{const {service,storage}=setup();assert.equal((await service.ask('u','魔法之眼')).body.remaining,49);assert.equal((await service.ask('u','魔法之眼')).body.remaining,48);await storage.put('user:'+dayKey()+':u',50);assert.equal((await service.ask('u','魔法之眼')).status,429);await storage.put('global:'+dayKey(),400);assert.equal((await service.ask('other','魔法之眼')).status,429)});
test('failed or ungrounded answers release daily reservation',async()=>{const {service,storage,env}=setup();env.AI.run=async()=>({response:{answer:'沒有可靠依據。',factIds:['invented']}});assert.equal((await service.ask('u','魔法之眼')).status,503);assert.equal(await storage.get('user:'+dayKey()+':u'),0);assert.equal(await storage.get('global:'+dayKey()),0)});
test('Free-only acknowledgement is required before activation',async()=>{const {service,env}=setup();env.FREE_ONLY_ACK='false';assert.equal((await service.ask('u','魔法之眼')).status,503)});
test('app day resets at UTC+8 midnight',()=>{assert.equal(dayKey(Date.parse('2026-10-06T15:59:59Z')),'2026-10-06');assert.equal(dayKey(Date.parse('2026-10-06T16:00:00Z')),'2026-10-07')});
test('concurrent reservations cannot overrun the global daily cap',async()=>{const {service,storage}=setup();await storage.put('global:'+dayKey(),399);const results=await Promise.all([service.ask('a','魔法之眼'),service.ask('b','魔法之眼')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,429]);assert.equal(await storage.get('global:'+dayKey()),400)});
test('expired answer caches and old counters are deleted, current counters remain',async()=>{const {service,storage}=setup();await storage.put('cache:expired',{expires:0});await storage.put('cache:current',{expires:Date.now()+60000});await storage.put('user:2020-01-01:u',1);await storage.put('user:'+dayKey()+':u',1);await service.cleanup();assert.equal(await storage.get('cache:expired'),undefined);assert.equal(await storage.get('user:2020-01-01:u'),undefined);assert(await storage.get('cache:current'));assert.equal(await storage.get('user:'+dayKey()+':u'),1)});
test('follow-up uses prior user and assistant turns and cannot access another player conversation',async()=>{const {service,storage,env}=setup(),cid='00000000-0000-4000-8000-000000000001';const prompts=[];env.AI.run=async(_,input)=>{prompts.push(input.messages.map(m=>m.content).join('\n'));return {response:{answer:'這是根據資料整理的回答。',factIds:['1']}}};await service.ask('a','魔法之眼',cid);assert.equal((await service.ask('a','那機率呢？',cid)).body.facts.length,1);assert(prompts[1].includes('魔法之眼'));assert(prompts[1].includes('魔法之眼'));assert(prompts[1].includes('這是根據資料整理的回答。'));assert.equal((await service.ask('b','那機率呢？',cid)).body.facts.length,0);assert.equal(await storage.get('conversation:b:'+cid),undefined);await storage.put('conversation:a:'+cid,{expires:0,questions:['魔法之眼'],answers:['舊答案'],context:'魔法之眼'});assert.equal((await service.ask('a','那機率呢？',cid)).body.facts.length,0)});
test('client cannot provide an arbitrary conversation storage path',()=>{assert.throws(()=>questionBody({question:'test',conversationId:'../other-player'}));assert.equal(questionBody({question:'test',conversationId:'00000000-0000-4000-8000-000000000001'}).question,'test')});

test('model input uses player instructions, short IDs and summaries instead of raw JSON',async()=>{const {service,env}=setup();env.ASSETS.fetch=async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[{file:'one.json',terms:'魔法之眼'}]}:[{...fact,text:JSON.stringify({secretRawMarker:'must-stay-in-source'}),playerTitle:'搜尋森林豪宅寶箱',playerSummary:'魔法之眼：每次開箱有 10% 機率取得，數量 1。'}]);env.AI.run=async(_,input)=>{const p=input.messages.map(m=>m.content).join('\n');assert(p.includes('玩家'));assert(p.includes('"id":"1"'));assert(!p.includes('must-stay-in-source'));assert(!p.includes('test-id'));return {response:{answer:'這是根據資料整理的回答。',factIds:['1']}}};const result=await service.ask('u','魔法之眼');assert.equal(result.body.facts[0].id,'test-id');assert(result.body.facts[0].text.includes('must-stay-in-source'))});

test('conversation prompt prioritizes direct corrections, constraints and non-repetition',async()=>{const {service,env}=setup();let prompt='';env.AI.run=async(_,input)=>{prompt=input.messages.map(m=>m.content).join('\n');return {response:{answer:'對，先修正上一輪結論。',factIds:['1']}}};await service.ask('u','魔法之眼怎麼取得？','00000000-0000-4000-8000-000000000002');await service.ask('u','但你剛剛說的真的符合嗎？','00000000-0000-4000-8000-000000000002');assert.match(prompt,/承接上一輪/);assert.match(prompt,/三個、可以飛、基地安全/);assert.match(prompt,/不能把上一輪資料重新完整念一遍/);assert.match(prompt,/剛剛那三隻不符合會飛這個條件/);assert.match(prompt,/魔法之眼/);assert.match(prompt,/魔法之眼怎麼取得/)});

test('broad conversational questions use gameplay playbook instead of dead-end fallback',async()=>{
 const storage=new Store();
 const playbook=[
  {id:'playbook:bored',title:'做一條小型自動化',category:'activity',search:'無聊 幹嘛 做什麼 推薦',labels:['Create'],source:'本站教學',playerTitle:'做一條小型自動化',playerSummary:'挑一種常用材料做成小型自動化產線。'},
  {id:'playbook:dragon',title:'龍的地形破壞',category:'dragon-behavior',search:'龍 破壞地形 拆樹',labels:['龍'],source:'程式查核',playerTitle:'龍的地形破壞',playerSummary:'部分龍會被動拆樹，必須分開看拆樹、點火與技能破壞。'}
 ];
 const prompts=[];
 const env={FREE_ONLY_ACK:'true',AI:{run:async(_,input)=>{prompts.push(input.messages.map(m=>m.content).join('\n'));const bored=input.messages.map(m=>m.content).join('\n').includes('我好無聊');return {response:{answer:bored?'可以先做一條小型自動化產線。':'要分開比較拆樹、點火與技能破壞。',factIds:['1']}}}},ASSETS:{fetch:async r=>{
  if(r.url.endsWith('manifest.json'))return Response.json({version:'v1',shards:[]});
  if(r.url.endsWith('player-playbook.json'))return Response.json(playbook);
  return Response.json([]);
 }}};
 const service=new GuideService(storage,env);
 const bored=await service.ask('u','我好無聊，現在可以幹嘛？');
 assert.match(bored.body.answer,/自動化/);assert.equal(bored.body.facts[0].id,'playbook:bored');
 const dragon=await service.ask('u','有哪些龍不會破壞地形？');
 assert.match(dragon.body.answer,/拆樹|點火|技能破壞/);assert.equal(dragon.body.facts[0].id,'playbook:dragon');
 assert(prompts.every(p=>p.includes('"answer":"直接給玩家看的答案"')));
});

test('unfamiliar conversational prompts are not limited to exact item-name lookups',async()=>{
 const questions=['我想蓋基地但不想打王，有什麼事能做？','想跟朋友一起玩，現在可以幹嘛？','只有半小時，推薦我做點什麼？'];
 for(const question of questions){
  const storage=new Store();
  const env={FREE_ONLY_ACK:'true',AI:{run:async()=>({response:{answer:'可以從一個小型、可完成的目標開始。',factIds:['1']}})},ASSETS:{fetch:async r=>r.url.endsWith('manifest.json')?Response.json({version:'v1',shards:[]}):r.url.endsWith('player-playbook.json')?Response.json([{id:'activity',title:'小型目標',category:'activity',search:'無聊 幹嘛 做什麼 玩什麼 推薦 下一步 基地 朋友 半小時',labels:['玩法'],source:'本站教學',playerTitle:'小型目標',playerSummary:'挑一個短時間能完成的建造、收集、遠征或合作目標。'}]):Response.json([])}};
  const result=await new GuideService(storage,env).ask('u',question);
  assert.notEqual(result.body.answer,'');assert.equal(/換個名稱問問看/.test(result.body.answer||''),false);
 }
});

test('whole-pack gameplay layer retrieves Tetra, MineColonies, Create and Valkyrien-style topics',async()=>{
 const cases=[
  ['tetra 最強武器怎麼做','tetra','Tetra 模組化武器'],
  ['殖民地農夫為什麼不工作','minecolonies','MineColonies 農夫'],
  ['create 機械手怎麼安排產線','create','Create 自動化'],
  ['Valkyrien Skies 的船為什麼會抖','valkyrienskies','Valkyrien Skies 載具']
 ];
 for(const [question,needle,title] of cases){
  const storage=new Store();
  const record={id:'game:'+needle,kind:'article',title,category:'教學',search:question+' '+needle,labels:[needle],source:'整包玩法知識',playerTitle:title,playerSummary:'這是 '+title+' 的玩法與排錯資料。'};
  const env={FREE_ONLY_ACK:'true',AI:{run:async(_,input)=>{
    const p=input.messages.map(m=>m.content).join('\n');
    assert(p.includes(title));
    return {response:{answer:'已依整包玩法知識整理答案。',factIds:['1']}};
  }},ASSETS:{fetch:async r=>{
    if(r.url.endsWith('manifest.json'))return Response.json({version:'v1',shards:[]});
    if(r.url.endsWith('player-playbook.json'))return Response.json([]);
    if(r.url.endsWith('gameplay-knowledge-index.json'))return Response.json({version:1,count:1,shards:[{file:'gameplay-knowledge-00.json'}]});
    if(r.url.endsWith('gameplay-knowledge-00.json'))return Response.json([record]);
    return Response.json([]);
  }}};
  const result=await new GuideService(storage,env).ask('u',question);
  assert.equal(result.body.facts[0].id,'game:'+needle);
  assert.match(result.body.answer,/整包玩法知識/);
 }
});


test('completed named equipment does not restrict a new recommendation to that equipment',async()=>{
 const {service,env}=setup();env.CONVERSATION_PLANNER='true';let calls=0;
 const pages={'manifest.json':{version:'v1',activities:'activities.json',shards:[{file:'existing.json',terms:'既有機器'}]},'coverage-index.json':{subjects:{'既有機器':[['existing.json',['操作']]]}},'existing.json':[{...fact,title:'既有機器',search:'既有機器'}],'activities.json':[{title:'新成品挑戰',group:'機械',article:'artillery',firstStep:'先準備新成品材料。'}],'player-playbook.json':[],'gameplay-knowledge-index.json':{shards:[]}};
 env.ASSETS.fetch=async r=>Response.json(pages[r.url.split('/').at(-1)]||[]);
 env.AI.run=async(_,input)=>{if(++calls===1)return {response:{...trophyPlan,query:'既有機器做好了 找新目標',mode:'recommendation',facet:'none',focus:['既有機器']}};const x=JSON.parse(input.messages.at(-1).content.replace(/\n\/no_think$/,''));assert(x.facts.some(f=>f.title==='新成品挑戰'));return {response:{answer:'今天做新成品挑戰。',factIds:['1']}}};
 assert.equal((await service.ask('u','既有機器做好了，幫我決定新目標')).status,200);
});
