import test from 'node:test';import assert from 'node:assert/strict';
import {GuideService,approvedIdentity,dayKey} from './core.js';
import {quotaChange,changeQuota,quotaReport,recordUsage,providerDay,providerReset} from './quota-admin.js';
class Store{constructor(){this.rows=new Map();this.queue=Promise.resolve()}async get(k){return structuredClone(this.rows.get(k))}async put(k,v){this.rows.set(k,structuredClone(v))}async delete(keys){for(const k of keys)this.rows.delete(k)}transaction(fn){const p=this.queue.then(()=>fn(this));this.queue=p.catch(()=>{});return p}}
const uid='11111111-1111-4111-8111-111111111111';
test('admin identity comes from fresh RPC, not mutable auth metadata',async()=>{
 const request=new Request('https://test',{headers:{Authorization:'Bearer test-token'}}),env={SUPABASE_URL:'https://test',SUPABASE_KEY:'public'};
 const fake=admin=>async url=>Response.json(url.endsWith('/user')?{id:uid,user_metadata:{admin:true}}:{active:true,admin});
 assert.deepEqual(await approvedIdentity(request,env,fake(false)),{id:uid,admin:false});assert.equal((await approvedIdentity(request,env,fake(true))).admin,true);
 assert.equal(await approvedIdentity(request,env,async url=>Response.json(url.endsWith('/user')?{id:uid}:{active:false,admin:true})),null);
});
test('quota settings reject over-budget, fractional, path injection and unrelated fields',()=>{
 for(const change of [{userId:'../user',limit:50},{userId:uid,limit:401},{userId:uid,limit:1.5},{userId:uid,limit:-1},{userId:uid,limit:50,admin:true},{geminiDailyLimit:0},{geminiDailyLimit:'50'},{}])assert.throws(()=>quotaChange(change));
 assert.deepEqual(quotaChange({userId:uid,limit:0}),{userId:uid,limit:0});assert.equal(quotaChange({geminiDailyLimit:500}).geminiDailyLimit,500);
});
test('lowering a player cap preserves usage, blocks before AI, and restoring default retains usage',async()=>{
 const storage=new Store(),env={FREE_ONLY_ACK:'true',CONVERSATION_PLANNER:'true',ASSETS:{fetch:async()=>Response.json({shards:[]})},AI:{run:()=>assert.fail('blocked before any AI request')}};
 const service=new GuideService(storage,env);await storage.put('user:'+dayKey()+':'+uid,3);await storage.put('global:'+dayKey(),3);
 await changeQuota(storage,quotaChange({userId:uid,limit:2}),'admin');assert.equal((await service.ask(uid,'hello')).status,429);assert.equal(await storage.get('user:'+dayKey()+':'+uid),3);
 const roster=[{user_id:uid,game_id:'Player'}],state={providers:[{provider:'gemini'},{provider:'cloudflare'}]};let report=await quotaReport(storage,dayKey(),roster,state);assert.equal(report.players[0].remaining,0);
 await changeQuota(storage,{userId:uid,limit:null},'admin');report=await quotaReport(storage,dayKey(),roster,state);assert.equal(report.players[0].limit,50);assert.equal(report.players[0].used,3);assert.equal(report.players[0].custom,false);
});
test('usage records both planning and answering attempts, never invents provider-wide remaining',async()=>{
 const storage=new Store();await recordUsage(storage,'gemini','attempt');await recordUsage(storage,'gemini','success',{inputTokens:10,outputTokens:5});await recordUsage(storage,'gemini','attempt');await recordUsage(storage,'gemini','error');await changeQuota(storage,{geminiDailyLimit:20},'admin');
 await storage.put('neurons:'+providerDay('cloudflare'),81);
 const r=await quotaReport(storage,dayKey(),[],{providers:[{provider:'gemini',available:true},{provider:'cloudflare',available:true}]});assert.equal(r.providers[0].siteRemaining,18);assert.equal(r.providers[0].usage.successes,1);assert.equal(r.providers[0].usage.errors,1);assert.equal(r.providers[1].siteRemaining,8419);assert(r.providers.every(p=>p.providerRemaining===null));
});
test('Gemini protective budget prevents an invocation and reports its own Pacific reset',async()=>{
 const storage=new Store();await changeQuota(storage,{geminiDailyLimit:1},'admin');await recordUsage(storage,'gemini','attempt');
 const service=new GuideService(storage,{gemini_api:'test-not-real'});assert.equal(await service.model('hello',()=>true),null);const state=await service.availability();assert.equal(state.providers[0].available,false);assert.equal(state.providers[0].reason,'daily_budget');assert(state.providers[0].retryAt>Date.now());
});
test('provider reset clocks handle Pacific daylight saving and are distinct from player day',()=>{
 const now=Date.parse('2026-10-07T06:59:59Z');assert.equal(providerDay('gemini',now),'2026-10-06');assert.equal(providerDay('cloudflare',now),'2026-10-07');assert.equal(providerReset('gemini',now),Date.parse('2026-10-07T07:00:00Z'));
 const winter=Date.parse('2026-12-07T07:59:59Z');assert.equal(providerReset('gemini',winter),Date.parse('2026-12-07T08:00:00Z'));
});
