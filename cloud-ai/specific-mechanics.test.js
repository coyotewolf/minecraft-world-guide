import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {GuideService} from './core.js';
import {concreteMechanicsReply} from './specific-mechanics.js';
const [nulljaw]=JSON.parse(await fs.readFile(new URL('../data/ai/saintsdragons-runtime-verified.json',import.meta.url),'utf8'));
const focus={focus:['虛顎龍']};
test('concrete verified taming repairs vague and guessed food; leaves accurate answers intact',()=>{
 for(const answer of ['請拿著對應食物餵食。','建議準備生鮭魚或肉品。','拿歌萊果到終界荒地右鍵餵食，20%機率馴服；失敗回血。']){
  const result=concreteMechanicsReply({answer,factIds:[]},[nulljaw],'虛顎龍要怎麼馴服',focus);
  assert.equal(result.answer,nulljaw.taming.answers.tame);assert.deepEqual(result.factIds,['1']);
 }
 const good={answer:'拿歌萊果到終界荒地找野生虛顎龍，右鍵餵食，每次20%機率馴服。不需要先降低血量。',factIds:['1']};
 assert.equal(concreteMechanicsReply(good,[nulljaw],'虛顎龍要怎麼馴服',focus),good);
 assert.deepEqual(concreteMechanicsReply({...good,factIds:['2']},[nulljaw],'虛顎龍要怎麼馴服',focus).factIds,['1']);
});
test('named collection instructions survive supplemental lookup without a species-specific runtime record',async()=>{
 const env={FREE_ONLY_ACK:'true',CONVERSATION_PLANNER:'true',ASSETS:{fetch:async r=>{try{
  const name=r.url.split('/').at(-1),data=JSON.parse(await fs.readFile(new URL('../data/ai/'+name,import.meta.url),'utf8'));
  if(name==='assistant-bootstrap.json')data.gameplay=data.gameplay.filter(f=>f.id!==nulljaw.id);
  return Response.json(data);
 }catch{return new Response('',{status:404})}}},AI:{run:async(_,input)=>{
  const body=JSON.parse(input.messages.at(-1).content.replace(/\n\/no_think$/,''));
  if(!Array.isArray(body.facts))return {response:{query:'虛顎龍 馴服 餵食',mode:'mechanism',facet:'companions',focus:['虛顎龍'],useHistory:false,progress:'unknown',exclude:[]}};
  const fact=body.facts.find(f=>f.title==='虛顎龍'&&f.text.includes('歌萊果')&&f.text.includes('20%'));assert(fact,'retain the concrete collection card rather than only generic dragon behavior');assert(body.retrievalCoverage.supplemental);
  return {response:{answer:'虛顎龍吃歌萊果。',factIds:[fact.id]}};
 }}};
 const result=await new GuideService(new Store(),env).ask('fixture-collection','虛顎龍怎麼馴服');assert.equal(result.status,200,JSON.stringify(result.body));assert(result.body.facts.some(f=>f.id==='collection:companion:saintsdragons:nulljaw'));
});
test('correction is limited to a single relevant verified species and stage',()=>{
 const draft={answer:'請餵適當食物。',factIds:[]};
 for(const q of ['虛顎龍可以飛嗎','虛顎龍餵什麼回血','虛顎龍餵什麼繁殖'])assert.equal(concreteMechanicsReply(draft,[nulljaw],q,focus),draft);
 assert.equal(concreteMechanicsReply(draft,[nulljaw],'阿波利克斯要怎麼馴服',{focus:['阿波利克斯']}),draft);
 assert.equal(concreteMechanicsReply(draft,[{...nulljaw,runtimeVerified:false}],'虛顎龍要怎麼馴服',focus),draft);
 const other={...nulljaw,id:'fixture:other',taming:{...nulljaw.taming,subject:'另一隻龍',aliases:[]}};
 assert.equal(concreteMechanicsReply(draft,[nulljaw,other],'虛顎龍和另一隻龍怎麼馴服',{focus:['虛顎龍','另一隻龍']}),draft);
 const custom={...other,taming:{...other.taming,requirements:{tame:[['蘋果']]},answers:{tame:'手持蘋果右鍵另一隻龍。'}}};
 assert.equal(concreteMechanicsReply(draft,[custom],'另一隻龍怎麼馴服',{focus:['另一隻龍']}).answer,'手持蘋果右鍵另一隻龍。');
});
class Store{constructor(){this.values=new Map()}async get(k){return structuredClone(this.values.get(k))}async put(k,v){this.values.set(k,structuredClone(v))}async delete(){}async transaction(fn){return fn(this)}}
test('real corpus retains exact Nulljaw taming evidence through supplement and review, including follow-ups and stale history',async()=>{
 const storage=new Store(),prompts=[];
 const env={FREE_ONLY_ACK:'true',CONVERSATION_PLANNER:'true',ANSWER_REVIEW:'true',ASSETS:{fetch:async r=>{try{return Response.json(JSON.parse(await fs.readFile(new URL('../data/ai/'+r.url.split('/').at(-1),import.meta.url),'utf8')))}catch{return new Response('',{status:404})}}},AI:{run:async(_,input)=>{
  const body=JSON.parse(input.messages.at(-1).content.replace(/\n\/no_think$/,''));
  if(!Array.isArray(body.facts))return {response:{query:'虛顎龍 馴服 餵食',mode:'mechanism',facet:'companions',focus:['虛顎龍'],useHistory:prompts.length>0,progress:'unknown',exclude:[]}};
  const fact=body.facts.find(f=>f.text.includes('食品標籤')&&f.text.includes('minecraft:chorus_fruit'));
  assert(fact,'complete food definition must reach writer and reviewer');assert(fact.text.includes('minecraft:end_barrens'));assert(fact.text.includes('20%'));assert(!fact.text.includes('建議準備生鮭魚'));
  assert(body.retrievalCoverage.supplemental,'exercise the evidence retention bug');prompts.push(body);
  return {response:{answer:'拿著對應食物餵食；建議準備生鮭魚或各類肉品。',factIds:[fact.id],searchQueries:[]}};
 }}};
 const service=new GuideService(storage,env),cid='22222222-2222-4222-8222-222222222222';
 await storage.put('conversation:fixture-specific-user:'+cid,{questions:['虛顎龍吃什麼'],answers:['拿生鮭魚或肉品餵牠。'],context:'虛顎龍',expires:Date.now()+86400000});
 for(const q of ['虛顎龍要怎麼馴服','他吃什麼','虛顎龍是否需要戰鬥減少血量再馴服']){
  const result=await service.ask('fixture-specific-user',q,cid);assert.equal(result.status,200,JSON.stringify(result.body));assert(result.body.answer.includes('歌萊果'));assert(result.body.answer.includes('20%'));assert(result.body.facts.some(f=>f.id===nulljaw.id));assert(!result.body.answer.includes('建議準備生鮭魚'));
  if(q.includes('血量'))assert(result.body.answer.startsWith('不需要'));
 }
 assert.equal(prompts.length,6,'writer plus reviewer for each question');
 const history=storage.values.get('conversation:fixture-specific-user:'+cid);assert(history.answers.slice(-3).every(t=>t.includes('歌萊果')),'remember corrected answers, not drafts');
});
