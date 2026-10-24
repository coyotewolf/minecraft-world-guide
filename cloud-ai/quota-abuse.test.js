import test from 'node:test';import assert from 'node:assert/strict';
import {GuideService} from './core.js';
import {providerDay,NEURON_BUDGET,reserveProviderAttempt,settleProviderAttempt} from './quota-admin.js';
class Store{constructor(){this.rows=new Map();this.queue=Promise.resolve()}async get(k){return structuredClone(this.rows.get(k))}async put(k,v){this.rows.set(k,structuredClone(v))}async delete(k){for(const x of Array.isArray(k)?k:[k])this.rows.delete(x)}transaction(fn){const p=this.queue.then(()=>fn(this));this.queue=p.catch(()=>{});return p}}
test('simultaneous Gemini requests cannot exceed one remaining provider attempt',async()=>{
 const s=new Store();await s.put('config:geminiDailyLimit',1);let calls=0;const original=globalThis.fetch;
 globalThis.fetch=async()=>{calls++;return Response.json({candidates:[{content:{parts:[{text:'ok'}]}}]})};
 try{const values=await Promise.all(Array.from({length:12},()=>new GuideService(s,{GEMINI_API_KEY:'test-not-real'}).model('hello',()=>true)));assert.equal(calls,1);assert.equal(values.filter(Boolean).length,1);assert.equal((await s.get('usage:'+providerDay('gemini')+':gemini')).attempts,1)}finally{globalThis.fetch=original}
});
test('retry cannot step past the configured Gemini attempt limit',async()=>{
 const s=new Store();await s.put('config:geminiDailyLimit',1);let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;return Response.json({},{status:503})};
 try{assert.equal(await new GuideService(s,{GEMINI_API_KEY:'test-not-real'}).model('hello',()=>true),null);assert.equal(calls,1)}finally{globalThis.fetch=original}
});
test('simultaneous Cloudflare requests reserve the remaining budget atomically',async()=>{
 const s=new Store();await s.put('neurons:'+providerDay('cloudflare'),NEURON_BUDGET-30);let calls=0;const env={AI:{run:async()=>{calls++;return {response:'ok'}}}};
 await Promise.all(Array.from({length:12},()=>new GuideService(s,env).model('hello',()=>true)));assert.equal(calls,1);assert((await s.get('neurons:'+providerDay('cloudflare')))<=NEURON_BUDGET);
});

test('concurrent settlements keep every debit and stay on the reserved day',async()=>{
 const s=new Store(),now=Date.parse('2026-10-23T23:59:59Z');
 const reservations=await Promise.all(Array.from({length:12},()=>reserveProviderAttempt(s,'cloudflare',25,now)));
 await s.put('neurons:2026-10-24',123);
 await Promise.all(reservations.map(r=>settleProviderAttempt(s,r,5)));
 assert.equal(await s.get('neurons:2026-10-23'),60);assert.equal(await s.get('neurons:2026-10-24'),123);
 assert.equal((await s.get('usage:2026-10-23:cloudflare')).attempts,12);
});
test('Cloudflare retries reserve again and stop at the remaining budget',async()=>{
 const s=new Store();await s.put('neurons:'+providerDay('cloudflare'),NEURON_BUDGET-30);let calls=0;
 assert.equal(await new GuideService(s,{AI:{run:async()=>{calls++;throw Error('temporary')}}}).model('hello',()=>true),null);
 assert.equal(calls,1);assert((await s.get('neurons:'+providerDay('cloudflare')))<=NEURON_BUDGET);
});
