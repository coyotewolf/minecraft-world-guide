import test from 'node:test';import assert from 'node:assert/strict';
import {GuideService,selectedFacts,approvedUser,providerAnswer,providerFailure,dayKey,questionBody} from './core.js';
class Store{constructor(){this.values=new Map();this.queue=Promise.resolve()}async get(k){return structuredClone(this.values.get(k))}async put(k,v){this.values.set(k,structuredClone(v))}async delete(keys){for(const key of keys)this.values.delete(key)}async list({prefix,limit,startAfter=''}){return new Map([...this.values].filter(([k])=>k.startsWith(prefix)&&k>startAfter).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit))}transaction(fn){const p=this.queue.then(()=>fn(this));this.queue=p.catch(()=>{});return p}}
const fact={id:'test-id',title:'魔法之眼',search:'魔法之眼',text:'森林豪宅寶箱',labels:[],shard:'one.json'};
function setup(){const storage=new Store(),env={FREE_ONLY_ACK:'true',AI:{run:async()=>({response:{answer:'這是根據資料整理的回答。',factIds:['1']}})},ASSETS:{fetch:async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[{file:'one.json',terms:'魔法之眼'}]}:[fact])}};return {storage,env,service:new GuideService(storage,env)}}
test('only exact supplied facts are returned; fabricated IDs reject the response',()=>{assert.deepEqual(selectedFacts('{"factIds":["unknown"]}',[fact]),[]);assert.deepEqual(selectedFacts({factIds:['test-id','test-id']},[fact]),[fact]);assert.deepEqual(selectedFacts('<script>bad</script>',[fact]),[])});
test('approved account check requires active RPC status',async()=>{const request=new Request('https://test',{headers:{Authorization:'Bearer fake'}}),env={SUPABASE_URL:'https://sb',SUPABASE_KEY:'public'};let calls=0;assert.equal(await approvedUser(request,env,async()=>Response.json(++calls===1?{id:'u'}:{active:false})),null);calls=0;assert.equal(await approvedUser(request,env,async()=>Response.json(++calls===1?{id:'u'}:{active:true})),'u')});
test('Gemini quota failure falls back to Cloudflare',async()=>{let fallback=0;const spent=[];const result=await providerAnswer({GEMINI_API_KEY:'not-real',AI:{run:async()=>{fallback++;return {response:{answer:'這是根據資料整理的回答。',factIds:['1']}}}}},'prompt',async()=>true,async(...args)=>spent.push(args),async()=>new Response('{}',{status:429}));assert.equal(result.provider,'cloudflare');assert.equal(fallback,1);assert(spent.some(x=>x[0]==='gemini'&&x[1]===60000))});
test('no allowed provider returns unavailable without paid route',async()=>{assert.equal(await providerAnswer({AI:{run:()=>assert.fail()}},'prompt',async()=>false,async()=>{}),null)});

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
 const {service,env}=setup();let prompt='';env.AI.run=async(_,input)=>{prompt=input.messages[0].content;return {response:{answer:'保留會飛條件。',factIds:['1']}}};
 await service.ask('u','魔法之眼','00000000-0000-4000-8000-000000000003',[{user:'找會飛又能騎的龍',assistant:'先比較地形效果。'}]);
 assert.match(prompt,/找會飛又能騎的龍/);
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
test('follow-up uses prior user and assistant turns and cannot access another player conversation',async()=>{const {service,storage,env}=setup(),cid='00000000-0000-4000-8000-000000000001';const prompts=[];env.AI.run=async(_,input)=>{prompts.push(input.messages[0].content);return {response:{answer:'這是根據資料整理的回答。',factIds:['1']}}};await service.ask('a','魔法之眼',cid);assert.equal((await service.ask('a','那機率呢？',cid)).body.facts.length,1);assert(prompts[1].includes('"priorTurns"'));assert(prompts[1].includes('"user":"魔法之眼"'));assert(prompts[1].includes('"assistant":"這是根據資料整理的回答。"'));assert.equal((await service.ask('b','那機率呢？',cid)).body.facts.length,0);assert.equal(await storage.get('conversation:b:'+cid),undefined);await storage.put('conversation:a:'+cid,{expires:0,questions:['魔法之眼'],answers:['舊答案'],context:'魔法之眼'});assert.equal((await service.ask('a','那機率呢？',cid)).body.facts.length,0)});
test('client cannot provide an arbitrary conversation storage path',()=>{assert.throws(()=>questionBody({question:'test',conversationId:'../other-player'}));assert.equal(questionBody({question:'test',conversationId:'00000000-0000-4000-8000-000000000001'}).question,'test')});

test('model input uses player instructions, short IDs and summaries instead of raw JSON',async()=>{const {service,env}=setup();env.ASSETS.fetch=async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[{file:'one.json',terms:'魔法之眼'}]}:[{...fact,text:JSON.stringify({secretRawMarker:'must-stay-in-source'}),playerTitle:'搜尋森林豪宅寶箱',playerSummary:'魔法之眼：每次開箱有 10% 機率取得，數量 1。'}]);env.AI.run=async(_,input)=>{const p=input.messages[0].content;assert(p.includes('玩家'));assert(p.includes('"id":"1"'));assert(!p.includes('must-stay-in-source'));assert(!p.includes('test-id'));return {response:{answer:'這是根據資料整理的回答。',factIds:['1']}}};const result=await service.ask('u','魔法之眼');assert.equal(result.body.facts[0].id,'test-id');assert(result.body.facts[0].text.includes('must-stay-in-source'))});

test('conversation prompt prioritizes direct corrections, constraints and non-repetition',async()=>{const {service,env}=setup();let prompt='';env.AI.run=async(_,input)=>{prompt=input.messages[0].content;return {response:{answer:'對，先修正上一輪結論。',factIds:['1']}}};await service.ask('u','魔法之眼怎麼取得？','00000000-0000-4000-8000-000000000002');await service.ask('u','但你剛剛說的真的符合嗎？','00000000-0000-4000-8000-000000000002');assert.match(prompt,/承接上一輪/);assert.match(prompt,/三個、可以飛、基地安全/);assert.match(prompt,/不能把上一輪資料重新完整念一遍/);assert.match(prompt,/剛剛那三隻不符合會飛這個條件/);assert.match(prompt,/"priorTurns"/);assert.match(prompt,/魔法之眼怎麼取得/)});

test('broad conversational questions use gameplay playbook instead of dead-end fallback',async()=>{
 const storage=new Store();
 const playbook=[
  {id:'playbook:bored',title:'做一條小型自動化',category:'activity',search:'無聊 幹嘛 做什麼 推薦',labels:['Create'],source:'本站教學',playerTitle:'做一條小型自動化',playerSummary:'挑一種常用材料做成小型自動化產線。'},
  {id:'playbook:dragon',title:'龍的地形破壞',category:'dragon-behavior',search:'龍 破壞地形 拆樹',labels:['龍'],source:'程式查核',playerTitle:'龍的地形破壞',playerSummary:'部分龍會被動拆樹，必須分開看拆樹、點火與技能破壞。'}
 ];
 const prompts=[];
 const env={FREE_ONLY_ACK:'true',AI:{run:async(_,input)=>{prompts.push(input.messages[0].content);const bored=input.messages[0].content.includes('我好無聊');return {response:{answer:bored?'可以先做一條小型自動化產線。':'要分開比較拆樹、點火與技能破壞。',factIds:['1']}}}},ASSETS:{fetch:async r=>{
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
    const p=input.messages[0].content;
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
