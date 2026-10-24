import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clientAccess} from './client-access.js';
import {ANSWER_CACHE_VERSION} from './core.js';
let source=await readFile(new URL('./worker.js',import.meta.url),'utf8');
source=source.replace("import {DurableObject} from 'cloudflare:workers';",'class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }');
source=source.replace(/from '(\.\.?\/[^']+)'/g,(_,path)=>`from '${new URL(path,import.meta.url).href}'`);
const {default:worker,GuideCoordinator}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const origin='https://coyotewolf.github.io';
const native=(path='/ask',method='POST',body={question:'魔法之眼',conversationId:'00000000-0000-4000-8000-000000000001',requestId:'00000000-0000-4000-8000-000000000002'},headers={Authorization:'Bearer good'})=>new Request('https://worker.example'+path,{method,headers,...(method==='POST'?{body:JSON.stringify(body)}:{})});
function fixture(){
 const calls=[];
 const env={SITE_ORIGIN:origin,SUPABASE_URL:'https://db.example',SUPABASE_KEY:'public',GUIDE:{getByName(){return {completeContext:async(...args)=>{calls.push(['context',...args]);return {status:200,body:{answer:'補充回答',facts:[]}};},ask:async(...args)=>{calls.push(['ask',...args]);return {status:200,body:{answer:'測試回答',facts:[]}};},forget:async(...args)=>calls.push(['forget',...args]),availability:async()=>({ready:true})};}}};
 return {env,calls};
}
const originalFetch=globalThis.fetch;
test.after(()=>globalThis.fetch=originalFetch);
function auth({active=true,valid=true}={}){
 globalThis.fetch=async(url,options)=>{
  if(options.headers.Authorization!=='Bearer good'||!valid)return Response.json({},{status:401});
  if(String(url).endsWith('/auth/v1/user'))return Response.json({id:'owner-from-jwt'});
  if(String(url).endsWith('/rpc/player_status'))return Response.json({active,admin:false});
  if(String(url).includes('/assistant_messages'))return Response.json([]);
  throw Error('Unexpected request');
 };
}
test('native ask authenticates using JWT ownership and the original guide',async()=>{
 auth();const {env,calls}=fixture();const r=await worker.fetch(native(),env);
 assert.equal(r.status,200);assert.equal(calls[0][1],'owner-from-jwt');assert.equal(calls[0][4].length,0);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
});
test('native status and forget use the same active-player check',async()=>{
 auth();const {env,calls}=fixture();assert.equal((await worker.fetch(native('/status','GET'),env)).status,200);
 assert.equal((await worker.fetch(native('/forget','POST',{conversationId:'00000000-0000-4000-8000-000000000001',user_id:'attacker'}),env)).status,200);assert.equal(calls[0][1],'owner-from-jwt');
});
test('missing and invalid JWT never invoke model work',async()=>{
 auth({valid:false});const {env,calls}=fixture();
 for(const headers of [{},{Authorization:'Bearer bad'},{Authorization:'Bearer '}])assert.equal((await worker.fetch(native('/ask','POST',{question:'test'},headers),env)).status,401);
 assert.equal(calls.length,0);
});
test('unapproved player cannot ask, forget or inspect providers',async()=>{
 auth({active:false});const {env,calls}=fixture();
 for(const [path,method] of [['/ask','POST'],['/forget','POST'],['/status','GET']])assert.equal((await worker.fetch(native(path,method),env)).status,401);
 assert.equal(calls.length,0);
});
test('browser allowlist and OPTIONS remain compatible',async()=>{
 const {env}=fixture();const r=await worker.fetch(new Request('https://worker.example/ask',{method:'OPTIONS',headers:{Origin:origin}}),env);
 assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
 for(const value of ['null','https://evil.example',''])assert.equal(clientAccess(new Request('https://worker.example/ask',{headers:{Origin:value}}),env).status,403);
});
test('spoofed allowed Origin cannot bypass JWT auth',async()=>{
 auth({valid:false});const {env,calls}=fixture();
 assert.equal((await worker.fetch(native('/ask','POST',{question:'test'},{Origin:origin,Authorization:'Bearer bad'}),env)).status,401);assert.equal(calls.length,0);
});
test('native clients cannot reach admin, health, wrong verbs or preflight',()=>{
 const {env}=fixture();for(const [path,method] of [['/admin/quotas','GET'],['/health','GET'],['/ask','GET'],['/status','POST'],['/ask','OPTIONS']])assert.equal(clientAccess(native(path,method),env).status,403);
});
test('rollback switch preserves the website',()=>{
 const {env}=fixture();env.NATIVE_CLIENT_ENABLED='false';assert.equal(clientAccess(native(),env).status,403);
 assert.equal(clientAccess(native('/ask','POST',{}, {Origin:origin}),env).status,undefined);
});
test('invalid body, UUID and size cannot consume model quota',async()=>{
 auth();const {env,calls}=fixture();for(const body of [{question:''},{question:'x'.repeat(601)},{question:'test',requestId:'bad'},{question:'test',conversationId:'bad'},{question:'x'.repeat(5000)}])assert([400,413].includes((await worker.fetch(native('/ask','POST',body),env)).status));assert.equal(calls.length,0);
});
test('429 and 503 preserve retryAt without fabricating answers',async()=>{
 auth();const {env}=fixture();for(const status of [429,503]){
  env.GUIDE.getByName=()=>({ask:async()=>({status,body:{error:'不可用',retryAt:123456789}})});
  const r=await worker.fetch(native(),env);assert.equal(r.status,status);assert.equal((await r.json()).answer,undefined);
 }
});
class Store {
 constructor(){this.m=new Map();}
 async get(k){return structuredClone(this.m.get(k));}
 async put(k,v){this.m.set(k,structuredClone(v));}
 async delete(keys){for(const k of Array.isArray(keys)?keys:[keys])this.m.delete(k);}
 async list({prefix,limit=1000}){return new Map([...this.m].filter(([k])=>k.startsWith(prefix)).slice(0,limit));}
 async transaction(fn){return fn(this);}
 async getAlarm(){return Date.now()+86400000;}
 async setAlarm(){}
}
test('coordinator reuses successful request UUID and rejects changed content',async()=>{
 const storage=new Store();await storage.put('request:owner:cid:'+ANSWER_CACHE_VERSION+':rid',{question:'q',result:{status:200,body:{answer:'cached'}},expires:Date.now()+10000});
 const c=new GuideCoordinator({storage},{});assert.equal((await c.ask('owner','q','cid',[],'rid')).body.answer,'cached');assert.equal((await c.ask('owner','changed','cid',[],'rid')).status,409);
});
test('forget isolates account caches and preserves daily usage',async()=>{
 const storage=new Store();await storage.put('request:a:cid:rid',{expires:Date.now()+1000});await storage.put('request:b:cid:rid',{answer:'private'});await storage.put('user:day:a',5);
 const c=new GuideCoordinator({storage},{});await c.forget('a','cid');assert.equal(await storage.get('request:a:cid:rid'),undefined);assert.equal((await storage.get('request:b:cid:rid')).answer,'private');assert.equal(await storage.get('user:day:a'),5);
});

test('coordinator ignores pre-policy retry responses and forget deletes versioned caches',async()=>{
 const storage=new Store();await storage.put('request:owner:cid:rid',{question:'q',result:{status:200,body:{answer:'old wrong food'}},expires:Date.now()+10000});
 const c=new GuideCoordinator({storage},{FREE_ONLY_ACK:'false'});const result=await c.ask('owner','q','cid',[],'rid');assert.notEqual(result.body.answer,'old wrong food');assert.notEqual(result.status,200);
 const current='request:owner:cid:'+ANSWER_CACHE_VERSION+':rid';await storage.put(current,{question:'q',result:{status:200,body:{answer:'current'}},expires:Date.now()+10000});
 await c.forget('owner','cid');assert.equal(await storage.get(current),undefined);assert.equal(await storage.get('request:owner:cid:rid'),undefined);
});

test('local search request retry is cached, and older clients cannot reuse its action response',async()=>{
 const storage=new Store(),key='request:owner:cid:'+ANSWER_CACHE_VERSION+':find';const action={version:1,type:'nearby_entities',query:'虛顎龍',radius:0};await storage.put(key,{question:'找牠',contextKey:'|localSearch:1',result:{status:200,body:{clientAction:action}},expires:Date.now()+10000});
 const c=new GuideCoordinator({storage},{});assert.deepEqual((await c.ask('owner','找牠','cid',[],'find',null,true)).body.clientAction,action);assert.equal((await c.ask('owner','找牠','cid',[],'find',null,false)).status,409);
});

test('ID action cache cannot be reused by old clients or nearby-only clients',async()=>{const storage=new Store(),key='request:owner:cid:'+ANSWER_CACHE_VERSION+':id';const action={version:1,type:'registry_id',query:'@hand',kind:'item'};await storage.put(key,{question:'手持ID',contextKey:'|registry:1',result:{status:200,body:{clientAction:action}},expires:Date.now()+10000});const c=new GuideCoordinator({storage},{});assert.deepEqual((await c.ask('owner','手持ID','cid',[],'id',null,false,true)).body.clientAction,action);assert.equal((await c.ask('owner','手持ID','cid',[],'id',null,true,false)).status,409);assert.equal((await c.ask('owner','手持ID','cid',[],'id',null,false,false)).status,409);});

test('current biome cached actions are capability-specific and not returned to older clients',async()=>{const storage=new Store(),key='request:owner:cid:'+ANSWER_CACHE_VERSION+':biome';const action={version:1,type:'current_biome'};await storage.put(key,{question:'現在是什麼群系',contextKey:'|biome:1',result:{status:200,body:{clientAction:action}},expires:Date.now()+10000});const c=new GuideCoordinator({storage},{});assert.deepEqual((await c.ask('owner','現在是什麼群系','cid',[],'biome',null,false,false,true)).body.clientAction,action);assert.equal((await c.ask('owner','現在是什麼群系','cid',[],'biome',null,false,false,false)).status,409);});

test('deferred continuation authenticates again, derives ownership from JWT and never trusts body user_id',async()=>{auth();const {env,calls}=fixture();const input={question:'我現在剩多少血',conversationId:'11111111-1111-4111-8111-111111111111',requestId:'22222222-2222-4222-8222-222222222222',contextToken:'33333333-3333-4333-8333-333333333333',clientContextVersion:1,playerContext:{version:1,player:{health:12}},user_id:'attacker'};const r=await worker.fetch(native('/ask','POST',input),env);assert.equal(r.status,200);assert.equal(calls[0][0],'context');assert.equal(calls[0][1],'owner-from-jwt');auth({active:false});const blocked=fixture();assert.equal((await worker.fetch(native('/ask','POST',input),blocked.env)).status,401);assert.equal(blocked.calls.length,0);});
test('duplicate context completion shares one model call, and forgetting a pending conversation prevents resurrection',async()=>{const storage=new Store(),cid='11111111-1111-4111-8111-111111111111',token='33333333-3333-4333-8333-333333333333',key='context-request:owner:'+cid+':'+token;let begin,finish,calls=0;const begun=new Promise(r=>begin=r),gate=new Promise(r=>finish=r);const request={question:'目前生命',conversationId:cid,gameContext:null};const pending={question:request.question,cid,scene:null,trace:{},previous:{questions:[],answers:[]},compact:[],facts:[],draft:{answer:'未知'},remaining:10,version:'test',epoch:{key:'history-epoch:owner:'+cid,value:0},expires:Date.now()+10000};await storage.put(key,pending);const env={AI:{run:async()=>{calls++;begin();await gate;return {response:{status:'answered',answer:'12點生命值',evidencePaths:['/playerContext/player/health'],missingInformation:[]}}}}};const c=new GuideCoordinator({storage},env),extra={version:1,player:{health:12}},one=c.completeContext('owner',token,extra,request);await begun;const two=c.completeContext('owner',token,extra,request);await c.forget('owner',cid);finish();assert.equal((await one).status,409);assert.equal((await two).status,409);assert.equal(calls,1);assert.equal(await storage.get(key),undefined);assert.equal(await storage.get('conversation:owner:'+cid),undefined);});

test('successful deferred completion updates the original request cache with the same capability and scene key',async()=>{const storage=new Store(),cid='11111111-1111-4111-8111-111111111111',rid='22222222-2222-4222-8222-222222222222',body={question:'現在多少生命',conversationId:cid,requestId:rid,clientContextVersion:1,gameContext:{version:1,hands:{},inventory:[],armor:[],entities:[]}};const {questionBody}=await import('./core.js');const clean=questionBody(body);let calls=0;const env={FREE_ONLY_ACK:'true',CONVERSATION_PLANNER:'true',ASSETS:{fetch:async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[]}:[])},AI:{run:async(_,input)=>{calls++;const data=JSON.parse(input.messages.at(-1).content.replace(/\n\/no_think$/,''));if(data.subjectMatches)return {response:{query:body.question,mode:'chat',facet:'none',focus:[],exclude:[],progress:'unknown',useHistory:false}};if(data.playerContext)return {response:{status:'answered',answer:'你有12點生命值',evidencePaths:['/playerContext/player/health'],missingInformation:[]}};return {response:{answer:'目前無法讀取玩家生命',factIds:[],contextStatus:'needs_context'}};}}};const c=new GuideCoordinator({storage},env),first=await c.ask('owner',body.question,cid,[],rid,clean.gameContext,false,false,false,true);assert.equal(first.body.clientAction.type,'player_context');const result=await c.completeContext('owner',first.body.clientAction.token,{version:1,player:{health:12}},{question:body.question,conversationId:cid,requestId:rid,gameContext:clean.gameContext});assert.equal(result.status,200);const used=calls;const replay=await c.ask('owner',body.question,cid,[],rid,clean.gameContext,false,false,false,true);assert.equal(replay.body.answer,'你有12點生命值');assert.equal(calls,used);});

test('quota admin endpoint rejects forged metadata and preserves verified admin changes',async()=>{
 const uid='11111111-1111-4111-8111-111111111111';let admin=false,changes=[];
 globalThis.fetch=async url=>Response.json(String(url).endsWith('/user')?{id:'verified-owner',user_metadata:{admin:true}}:String(url).endsWith('/player_status')?{active:true,admin}:[{user_id:uid,game_id:'Fixture'}]);
 const env={SITE_ORIGIN:origin,SUPABASE_URL:'https://db.example',SUPABASE_KEY:'public',GUIDE:{getByName:()=>({adminChange:async(...args)=>changes.push(args),adminReport:async()=>({players:[]})})}};
 const req=body=>native('/admin/quotas','POST',body,{Authorization:'Bearer good',Origin:origin});
 assert.equal((await worker.fetch(req({userId:uid,limit:0}),env)).status,403);assert.equal(changes.length,0);
 admin=true;assert.equal((await worker.fetch(req({userId:uid,limit:0}),env)).status,200);
 assert.deepEqual(changes,[[{userId:uid,limit:0},'verified-owner']]);
 assert.equal((await worker.fetch(req({userId:uid,limit:50,admin:true}),env)).status,400);
 assert.equal((await worker.fetch(req({userId:'22222222-2222-4222-8222-222222222222',limit:50}),env)).status,404);
 assert.equal(changes.length,1);
 assert.equal((await worker.fetch(req({userId:uid,limit:null}),env)).status,200);
 assert.deepEqual(changes.at(-1),[{userId:uid,limit:null},'verified-owner']);
});
