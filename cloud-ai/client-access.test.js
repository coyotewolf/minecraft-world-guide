import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clientAccess} from './client-access.js';
let source=await readFile(new URL('./worker.js',import.meta.url),'utf8');
source=source.replace("import {DurableObject} from 'cloudflare:workers';",'class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }');
source=source.replace(/from '(\.\.?\/[^']+)'/g,(_,path)=>`from '${new URL(path,import.meta.url).href}'`);
const {default:worker,GuideCoordinator}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const origin='https://coyotewolf.github.io';
const native=(path='/ask',method='POST',body={question:'魔法之眼',conversationId:'00000000-0000-4000-8000-000000000001',requestId:'00000000-0000-4000-8000-000000000002'},headers={Authorization:'Bearer good'})=>new Request('https://worker.example'+path,{method,headers,...(method==='POST'?{body:JSON.stringify(body)}:{})});
function fixture(){
 const calls=[];
 const env={SITE_ORIGIN:origin,SUPABASE_URL:'https://db.example',SUPABASE_KEY:'public',GUIDE:{getByName(){return {ask:async(...args)=>{calls.push(['ask',...args]);return {status:200,body:{answer:'測試回答',facts:[]}};},forget:async(...args)=>calls.push(['forget',...args]),availability:async()=>({ready:true})};}}};
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
 const storage=new Store();await storage.put('request:owner:cid:rid',{question:'q',result:{status:200,body:{answer:'cached'}},expires:Date.now()+10000});
 const c=new GuideCoordinator({storage},{});assert.equal((await c.ask('owner','q','cid',[],'rid')).body.answer,'cached');assert.equal((await c.ask('owner','changed','cid',[],'rid')).status,409);
});
test('forget isolates account caches and preserves daily usage',async()=>{
 const storage=new Store();await storage.put('request:a:cid:rid',{expires:Date.now()+1000});await storage.put('request:b:cid:rid',{answer:'private'});await storage.put('user:day:a',5);
 const c=new GuideCoordinator({storage},{});await c.forget('a','cid');assert.equal(await storage.get('request:a:cid:rid'),undefined);assert.equal((await storage.get('request:b:cid:rid')).answer,'private');assert.equal(await storage.get('user:day:a'),5);
});
