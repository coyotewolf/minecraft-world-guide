import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {GuideService,questionBody,dayKey} from './core.js';import {validIntent} from './conversation-intent.js';
class Store{constructor(){this.values=new Map()}async get(k){return structuredClone(this.values.get(k))}async put(k,v){this.values.set(k,structuredClone(v))}async transaction(fn){return fn(this)}}
const plan={query:'虛顎龍 位置',mode:'mechanism',facet:'companions',focus:['虛顎龍'],useHistory:true,progress:'unknown',exclude:[],localSearch:{query:'saintsdragons:nulljaw'}};
test('AI semantic intent dispatches client search with full loaded scope, only one quota reservation and one model call',async()=>{
 const storage=new Store();let calls=0;
 const env={FREE_ONLY_ACK:'true',CONVERSATION_PLANNER:'true',ASSETS:{fetch:async r=>Response.json(JSON.parse(await fs.readFile(new URL('../data/ai/'+r.url.split('/').at(-1),import.meta.url),'utf8')))},AI:{run:async(_,input)=>{calls++;const body=JSON.parse(input.messages.at(-1).content.replace(/\n\/no_think$/,''));assert.equal(body.clientSearchEnabled,true);assert(!Array.isArray(body.facts),'not a fabricated location answer');return {response:plan};}}};
 const result=await new GuideService(storage,env).ask('locator-fixture','我看不到那隻，幫我指一下方向','11111111-1111-4111-8111-111111111111',[{user:'我想找虛顎龍',assistant:'可以找附近的野生個體。'}],null,true);
 assert.equal(result.status,200);assert.deepEqual(result.body.clientAction,{version:1,type:'nearby_entities',query:'saintsdragons:nulljaw',radius:0});assert.equal(calls,1);assert.equal(await storage.get('user:'+dayKey()+':locator-fixture'),1);assert.equal(result.body.answer,undefined,'client must read actual coordinates instead of trusting the model');
});
test('radius comes from AI interpretation only when specified and action schema is bounded',()=>{
 assert(validIntent(plan));assert(validIntent({...plan,localSearch:{query:'虛顎龍',radius:200}}));for(const radius of [0,-1,1.5,'200',2147483648])assert(!validIntent({...plan,localSearch:{query:'虛顎龍',radius}}));assert(!validIntent({...plan,localSearch:{query:'虛顎龍',command:'/op player'}}));
 assert.equal(questionBody({question:'找牠',clientSearchVersion:1}).clientSearchEnabled,true);assert.equal(questionBody({question:'找牠'}).clientSearchEnabled,false);assert.throws(()=>questionBody({question:'找牠',clientSearchVersion:2}));
});
