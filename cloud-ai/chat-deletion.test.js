import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const file=new URL('./worker.js',import.meta.url);
const source=(await fs.readFile(file,'utf8')).replace("import {DurableObject} from 'cloudflare:workers';","class DurableObject{constructor(ctx,env){this.ctx=ctx;this.env=env}}").replace(/from '(\.[^']+)'/g,(_,ref)=>'from '+JSON.stringify(new URL(ref,file).href));
const {GuideCoordinator,default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class Store{
 constructor(){this.values=new Map();this.queue=Promise.resolve()}
 async get(k){return structuredClone(this.values.get(k))}async put(k,v){this.values.set(k,structuredClone(v))}async delete(keys){for(const k of Array.isArray(keys)?keys:[keys])this.values.delete(k)}
 async list({prefix,limit=100,startAfter=''}){return new Map([...this.values].filter(([k])=>k.startsWith(prefix)&&k>startAfter).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit))}
 transaction(fn){const work=this.queue.then(()=>fn(this));this.queue=work.catch(()=>{});return work}async getAlarm(){return 1}async setAlarm(){}
}
const cid='12345678-1234-4234-8234-123456789012';
test('forget purges only this owner and conversation, including paginated caches, without refunding quota',async()=>{
 const storage=new Store(),coordinator=new GuideCoordinator({storage},{});
 storage.values.set('conversation:a:'+cid,{questions:['private']});storage.values.set('conversation:b:'+cid,{questions:['other']});storage.values.set('user:2026-10-08:a',12);
 for(let i=0;i<130;i++)storage.values.set('cache:answer:a:'+cid+':'+String(i).padStart(3,'0'),{body:{answer:'deleted'}});
 storage.values.set('cache:answer:b:'+cid+':x',{body:{answer:'keep'}});storage.values.set('request:a:'+cid+':r',{result:{answer:'deleted'}});
 await coordinator.forget('a',cid);assert.equal(await storage.get('conversation:a:'+cid),undefined);assert.deepEqual(await storage.get('conversation:b:'+cid),{questions:['other']});assert.equal((await storage.list({prefix:'cache:answer:a:'+cid+':'})).size,0);assert(await storage.get('cache:answer:b:'+cid+':x'));assert.equal(await storage.get('user:2026-10-08:a'),12);
 const size=storage.values.size;await coordinator.forget('a','87654321-4321-4321-8321-210987654321');assert.equal(storage.values.size,size);
});
test('a reply already generating when deletion happens cannot restore memory or be delivered as success',async()=>{
 const storage=new Store();let started,finish;const begun=new Promise(r=>started=r),gate=new Promise(r=>finish=r);let calls=0;
 const plan={query:'你好',mode:'chat',facet:'none',focus:[],exclude:[],progress:'unknown',useHistory:false};
 const env={FREE_ONLY_ACK:'true',CONVERSATION_PLANNER:'true',ASSETS:{fetch:async r=>Response.json(r.url.endsWith('manifest.json')?{version:'v1',shards:[]}:[])},AI:{run:async()=>{if(++calls===1)return {response:plan};started();await gate;return {response:{answer:'舊回覆',factIds:[]}}}}};
 const coordinator=new GuideCoordinator({storage},env),pending=coordinator.ask('a','你好',cid,[],'12345678-1234-4234-8234-123456789013');await begun;await coordinator.forget('a',cid);finish();const reply=await pending;
 assert.equal(reply.status,409);assert.equal(await storage.get('conversation:a:'+cid),undefined);assert.equal((await storage.list({prefix:'cache:answer:a:'+cid+':'})).size,0);assert.equal((await storage.list({prefix:'request:a:'+cid+':'})).size,0);
});
test('forget endpoint derives its owner from fresh authentication, ignores supplied user IDs, and rejects malformed targets',async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async url=>Response.json(String(url).endsWith('/user')?{id:'owner'}:{active:true});
 const env={SITE_ORIGIN:'https://guide.test',SUPABASE_URL:'https://db.test',SUPABASE_KEY:'public-test-key',GUIDE:{getByName:()=>({forget:async(...args)=>calls.push(args)})}};
 const request=body=>new Request('https://worker.test/forget',{method:'POST',headers:{Origin:'https://guide.test',Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify(body)});
 try{assert.equal((await worker.fetch(request({conversationId:cid,userId:'victim'}),env)).status,200);assert.deepEqual(calls,[['owner',cid]]);assert.equal((await worker.fetch(request({conversationId:'../../victim'}),env)).status,400);assert.equal((await worker.fetch(new Request('https://worker.test/forget',{method:'POST',headers:{Origin:'https://guide.test'}}),env)).status,401)}finally{globalThis.fetch=original}
});
