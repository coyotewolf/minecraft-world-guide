import test from 'node:test';import assert from 'node:assert/strict';import {auditKey,purgeAuditFixtures} from './audit-cleanup.mjs';
const uid='dfbc1d3a-c7aa-4e74-995c-0e8e36b6ee6b',other='11111111-1111-4111-8111-111111111111';
class Store{constructor(){this.m=new Map()}async transaction(fn){return fn(this)}async list({limit,startAfter}){return new Map([...this.m].sort().filter(([k])=>!startAfter||k>startAfter).slice(0,limit))}async delete(keys){keys.forEach(k=>this.m.delete(k))}}
test('only exact fixture segments match; aggregate usage and other players remain',async()=>{
 const s=new Store();for(let i=0;i<222;i++){s.m.set('cache:answer:'+uid+':cid:'+i,{text:'fixture'});s.m.set('cache:answer:'+other+':cid:'+i,{text:'existing'})}
 for(const k of ['user:2026-10-24:'+uid,'minute:'+uid,'limit:'+uid,'quota-change:limit:'+uid,'history-epoch:'+uid+':cid'])s.m.set(k,1);
 for(const k of ['global:2026-10-24','neurons:2026-10-24','usage:2026-10-24:gemini','user:2026-10-24:'+other,'limit:'+uid+'-suffix'])s.m.set(k,77);
 const untouched=new Map([...s.m].filter(([k])=>!auditKey(k)));
 const r=await purgeAuditFixtures(s,new Map(),Date.parse('2026-10-24T14:00:00Z'));assert.equal(r.deleted,227);assert.equal(r.remaining,0);assert.deepEqual(s.m,untouched);
 assert.equal((await purgeAuditFixtures(s,new Map(),Date.parse('2026-10-24T14:00:00Z'))).deleted,0);
 await assert.rejects(()=>purgeAuditFixtures(s,new Map(),Date.parse('2026-10-25T14:00:00Z')),/expired/);
 await assert.rejects(()=>purgeAuditFixtures(s,new Map([['request:'+uid+':cid',{}]]),Date.parse('2026-10-24T14:00:00Z')),/active/);
});
