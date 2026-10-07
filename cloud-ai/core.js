import {REVIEW_POLICY,REVIEW_SCHEMA} from './answer-review.js';
import {playerLimit,recordUsage,qwenNeurons,providerDay,providerReset,NEURON_BUDGET} from './quota-admin.js';
import {retrieve,activityPool,retrieveMany,referenceQueries} from '../ai-search.js';
import {modelEvidence} from '../ai-evidence.js';
import {CHAT_POLICY,MECHANICS_POLICY} from './chat-policy.js';
import {INTENT_SCHEMA,INTENT_POLICY,validIntent,relationEvidence} from './conversation-intent.js';
export const ANSWER_CACHE_VERSION='zh-tw-v23-evidence-before-generation';
export const SCHEMA={type:'object',properties:{answer:{type:'string',maxLength:1600},factIds:{type:'array',items:{type:'string'},maxItems:4}},required:['answer','factIds'],additionalProperties:false};
export const dayKey=(now=Date.now())=>new Date(now+8*3600000).toISOString().slice(0,10);
export const utcDay=(now=Date.now())=>new Date(now).toISOString().slice(0,10);
export function questionBody(body){if(typeof body?.question!=='string'||!body.question.trim()||body.question.length>600)throw Error('請輸入 1～600 字的問題。');if(body.conversationId!==undefined&&(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.conversationId)||typeof body.conversationId!=='string'))throw Error('對話代碼無效。');if(body.requestId!==undefined&&(typeof body.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.requestId)))throw Error('訊息代碼無效。');return {question:body.question.trim(),conversationId:body.conversationId,requestId:body.requestId}}
function parseModelValue(value){
 if(typeof value!=='string')return value;
 try{return JSON.parse(value.replace(/^\s*<think>[\s\S]*?<\/think>\s*/,''))}catch{return null}
}
export function selectedFacts(value,candidates){
 const parsed=parseModelValue(value);
 if(!Array.isArray(parsed?.factIds)||parsed.factIds.length>6)return [];
 const allowed=new Map(candidates.map(f=>[f.id,f]));
 const ids=parsed.factIds.map(id=>Number.isInteger(id)&&id>=1&&id<=8?String(id):id);
 if(ids.some(id=>typeof id!=='string'||!allowed.has(id)))return [];
 return [...new Set(ids)].map(id=>allowed.get(id));
}
export function selectedReply(value,candidates){
 const parsed=parseModelValue(value);
 if(typeof parsed?.answer!=='string'||parsed.answer.trim().length<1||parsed.answer.length>1600)return {answer:'',facts:[]};
 return {answer:parsed.answer.trim(),facts:selectedFacts(parsed,candidates)};
}
export async function approvedIdentity(request,env,fetcher=fetch){const auth=request.headers.get('Authorization');if(!auth?.startsWith('Bearer ')||auth.length>8192)return null;const headers={Authorization:auth,apikey:env.SUPABASE_KEY};const user=await fetcher(env.SUPABASE_URL+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});if(!user.ok)return null;const data=await user.json();if(!data.id)return null;const status=await fetcher(env.SUPABASE_URL+'/rest/v1/rpc/player_status',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});if(!status.ok)return null;const state=await status.json();return state?.active===true?{id:data.id,admin:state.admin===true}:null}
export async function approvedUser(request,env,fetcher=fetch){return (await approvedIdentity(request,env,fetcher))?.id??null}
export function providerMessages(prompt){
 const split=prompt.lastIndexOf('\n{');
 if(split<0)return [{role:'user',content:prompt}];
 try{
  const {priorTurns=[],...current}=JSON.parse(prompt.slice(split+1));
  return [{role:'system',content:prompt.slice(0,split)},...priorTurns.flatMap(t=>[{role:'user',content:String(t.user||'')},...(t.assistant?[{role:'assistant',content:String(t.assistant)}]:[])]),{role:'user',content:JSON.stringify(current)}];
 }catch{return [{role:'user',content:prompt}]}
}
export async function providerAnswer(env,prompt,canUse,onSpend,fetcher=fetch,onFailure=async()=>{},valid=()=>true,options={}){
 const outputTokens=options.maxTokens||700;
 const messages=providerMessages(prompt),system=messages.find(m=>m.role==='system');
 if(options.schema)messages[0].content+='\n輸出 JSON 格式：'+JSON.stringify(options.schema);
 const geminiKey=env.GEMINI_API_KEY||env.gemini_api;
 const estimate=Math.ceil(new TextEncoder().encode(JSON.stringify(messages)).length*4625/1e6+outputTokens*30475/1e6);
 if(geminiKey&&await canUse('gemini',0)){
  await options.onUsage?.('gemini','attempt');
  const r=await fetcher('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':geminiKey},body:JSON.stringify({...(system?{systemInstruction:{parts:[{text:system.content}]}}:{}),contents:messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:{temperature:options.temperature??0.45,maxOutputTokens:outputTokens,responseMimeType:'application/json',responseJsonSchema:options.schema||SCHEMA}}),signal:AbortSignal.timeout(25000)}).catch(()=>null);
  if(r?.ok){const data=await r.json().catch(()=>({}));await options.onUsage?.('gemini','success',{inputTokens:data.usageMetadata?.promptTokenCount,outputTokens:data.usageMetadata?.candidatesTokenCount});const value=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');if(valid(value))return {value,provider:'gemini'};await onSpend('gemini',10000,0);await onFailure('gemini',{code:'invalid_answer',delay:10000})}
  else
  if(r){await options.onUsage?.('gemini','error');const details=await r.json().catch(()=>({}));const wait=providerFailure(r.status,details,r.headers.get('Retry-After'));await onSpend('gemini',wait.delay,0);await onFailure('gemini',wait)}else{await options.onUsage?.('gemini','error');await onSpend('gemini',60000,0);await onFailure('gemini',{code:'connection',delay:60000})}
 }
 if(env.AI&&await canUse('cloudflare',estimate)){
  // Reserve worst-case tokens before invoking the free binding, even on errors.
  await onSpend('cloudflare',0,estimate);await options.onUsage?.('cloudflare','attempt');
  try{const value=await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8',{messages:messages.map((m,i)=>i===messages.length-1?{...m,content:m.content+'\n/no_think'}:m),max_tokens:outputTokens,temperature:options.temperature??0.45});const settled=qwenNeurons(value.usage);if(settled!==null)await onSpend('cloudflare',0,settled-estimate);await options.onUsage?.('cloudflare','success',{inputTokens:value.usage?.prompt_tokens,outputTokens:value.usage?.completion_tokens});const answer=value.response??value.choices?.[0]?.message?.content;if(valid(answer))return {value:answer,provider:'cloudflare'};await onFailure('cloudflare',{code:'invalid_answer',delay:10000});await onSpend('cloudflare',10000,0)}catch{await options.onUsage?.('cloudflare','error');await onSpend('cloudflare',60000,0);await onFailure('cloudflare',{code:'service',delay:60000})}
 }
 return null;
}
export function providerFailure(status,body={},retryHeader=null){
 const details=body.error?.details||[];
 const retry=details.find(d=>d.retryDelay)?.retryDelay;
 const seconds=Number.parseFloat(retry||retryHeader||'');
 const daily=details.some(d=>(d.violations||[]).some(v=>/perday|daily/i.test(v.quotaId||'')));
 const code=status===429?(daily?'daily_quota':'rate_limit'):[400,401,403,404].includes(status)?'configuration':'service';
 return {code,status,delay:Math.max(1000,Math.min(86400000,Number.isFinite(seconds)?seconds*1000:status===429?60000:300000))};
}
export class GuideService{
 constructor(storage,env){this.storage=storage;this.env=env;this.manifest=null;this.playbook=null;this.gameplay=null;this.translations=null;this.translationMatchers=null}
 async read(name){if(this.requestReads?.has(name))return this.requestReads.get(name);if(this.requestReads&&++this.assetReadCount>40)throw Error('subrequest_budget');const result=(async()=>{const response=await this.env.ASSETS.fetch(new Request('https://knowledge.invalid/'+name));if(!response.ok)throw Error('knowledge_unavailable');return response.json()})();this.requestReads?.set(name,result);return result}
 async loadBootstrap(){if(this.bootstrap!==undefined)return;const b=await this.read('assistant-bootstrap.json').catch(()=>null);this.bootstrap=b&&b.version===this.manifest.version&&b.names&&!Array.isArray(b.names)&&Array.isArray(b.gameplay)&&Array.isArray(b.playbook)?b:null}
 async loadTranslations(){
  if(this.translations)return this.translations;
  const merged=this.bootstrap?.names||{};
  if(!this.bootstrap){try{
   const index=await this.read('translation-registry-index.json');
   const pages=await Promise.all((index.shards||[]).map(file=>this.read(file)));
   for(const page of pages)Object.assign(merged,page||{});
  }catch{}
  try{Object.assign(merged,(await this.read('zh-tw-core-names.json'))?.map||{})}catch{}}
  this.translations=merged;
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const keys=Object.keys(merged).filter(x=>x.length>=2&&merged[x]&&merged[x]!==x).sort((a,b)=>b.length-a.length);
  this.translationMatchers=[];
  for(let i=0;i<keys.length;i+=500){
   const group=keys.slice(i,i+500).map(escape).join('|');
   this.translationMatchers.push(new RegExp('(?<![A-Za-z0-9_])(?:'+group+')(?![A-Za-z0-9_])','g'));
  }
  return this.translations;
 }
 localize(text){
  if(typeof text!=='string'||!text||!this.translations)return text;
  let out=text;
  for(const re of this.translationMatchers||[])out=out.replace(re,m=>this.translations[m]||m);
  return out;
 }
 localizeFact(f){
  if(!f)return f;
  const copy={...f};
  for(const k of ['title','playerTitle','playerSummary','text','source'])if(typeof copy[k]==='string')copy[k]=this.localize(copy[k]);
  if(Array.isArray(copy.labels))copy.labels=copy.labels.map(x=>this.localize(x));
  return copy;
 }
 async model(prompt,valid,options={}){return providerAnswer(this.env,prompt,async(p,estimate)=>{const cooldown=await this.storage.get('cooldown:'+p)||0;if(cooldown>Date.now())return false;if(p==='cloudflare'){if((await this.storage.get('neurons:'+utcDay())||0)+estimate>8500){await this.storage.put('cooldown:cloudflare',Date.parse(utcDay()+'T00:00:00Z')+86400000);await this.storage.put('failure:cloudflare',{code:'daily_budget',at:Date.now()});return false}return true;}const cap=await this.storage.get('config:geminiDailyLimit');if(cap!==undefined&&(await this.storage.get('usage:'+providerDay('gemini')+':gemini'))?.attempts>=cap)return false;return true},async(p,delay,spend)=>{if(delay)await this.storage.put('cooldown:'+p,Date.now()+delay);if(spend)await this.storage.put('neurons:'+utcDay(),Math.max(0,(await this.storage.get('neurons:'+utcDay())||0)+spend))},fetch,async(p,reason)=>this.storage.put('failure:'+p,{...reason,at:Date.now()}),valid,{...options,onUsage:(p,event,details)=>recordUsage(this.storage,p,event,details)})}
 async availability(){
  const now=Date.now(),ready=[],failures=[];
  for(const name of ['gemini','cloudflare']){const cooldown=await this.storage.get('cooldown:'+name)||0;const failure=await this.storage.get('failure:'+name);const configured=name==='gemini'?!!(this.env.GEMINI_API_KEY||this.env.gemini_api):!!this.env.AI;const cap=await this.storage.get('config:geminiDailyLimit');const budget=name==='cloudflare'?(await this.storage.get('neurons:'+utcDay())||0)>=8480:cap!==undefined&&((await this.storage.get('usage:'+providerDay('gemini')+':gemini'))?.attempts||0)>=cap;
   ready.push({provider:name,available:configured&&!budget&&cooldown<=now,retryAt:budget?providerReset(name):cooldown>now?cooldown:null,reason:budget?'daily_budget':cooldown>now?failure?.code||'cooldown':configured?null:'configuration'});
   if(failure)failures.push({provider:name,code:failure.code,status:failure.status,at:failure.at});
  }
  const times=ready.filter(x=>x.retryAt).map(x=>x.retryAt),daily=ready.every(x=>['daily_quota','daily_budget','configuration'].includes(x.reason));
  return {providers:ready,lastFailures:failures,code:daily?'free_quota':'temporarily_unavailable',retryAt:times.length?Math.min(...times):null,message:daily?'小助手今天的免費額度已用完。聊天紀錄會保留，你仍可使用搜尋。':'小助手暫時忙碌或連線不穩，請稍後按「重試」。聊天紀錄會保留，搜尋也能繼續使用。'};
 }
 async cleanup(){for(const prefix of ['conversation:','request:','cache:','user:','global:','neurons:','usage:','minute:','cooldown:']){let after;do{const page=await this.storage.list({prefix,limit:100,...(after?{startAfter:after}:{})});const obsolete=[];for(const [key,value] of page){after=key;const stale=['cache:','conversation:','request:'].includes(prefix)?value.expires<Date.now():prefix==='minute:'?value.at<Date.now()-86400000:prefix==='cooldown:'?value<Date.now():key.split(':')[1]<new Date(Date.now()-7*86400000).toISOString().slice(0,10);if(stale)obsolete.push(key)}if(obsolete.length)await this.storage.delete(obsolete);if(page.size<100)break}while(true)}}
 async ask(uid,question,conversationId,cloudTurns=[]){
  if(this.env.FREE_ONLY_ACK!=='true')return {status:503,body:{error:'雲端問答尚未啟用。請使用解包資料搜尋。'}};
  this.stage='manifest';this.manifest??=await this.read('manifest.json');
  const conversationKey=conversationId?'conversation:'+uid+':'+conversationId:null;
  const saved=conversationKey?await this.storage.get(conversationKey):null;
  const previous=cloudTurns.length?{questions:cloudTurns.map(t=>t.user),answers:cloudTurns.map(t=>t.assistant),context:cloudTurns.map(t=>t.user).join(' ').slice(-1800)}:saved?.expires>Date.now()?saved:{questions:[],answers:[],context:''};
  previous.questions=Array.isArray(previous.questions)?previous.questions:[];
  previous.answers=Array.isArray(previous.answers)?previous.answers:[];
  const priorIntent=saved?.expires>Date.now()&&validIntent(saved.intent)?saved.intent:null;
  const day=dayKey(),uk='user:'+day+':'+uid,gk='global:'+day,mk='minute:'+uid;
  const slot=await this.storage.transaction(async tx=>{const limit=await playerLimit(tx,uid),u=await tx.get(uk)||0,g=await tx.get(gk)||0,m=await tx.get(mk)||{at:0,n:0};if(u>=limit||g>=400)return {error:'今日免費問答額度已用完，仍可搜尋解包資料。',status:429};if(Date.now()-m.at<60000&&m.n>=4)return {error:'提問稍快，請等一分鐘再試。',status:429};await tx.put(uk,u+1);await tx.put(gk,g+1);await tx.put(mk,Date.now()-m.at<60000?{at:m.at,n:m.n+1}:{at:Date.now(),n:1});return {remaining:Math.max(0,limit-u-1)}});
  if(slot.error)return {status:slot.status,body:slot};
  const release=()=>this.storage.transaction(async tx=>{await tx.put(uk,Math.max(0,(await tx.get(uk)||0)-1));await tx.put(gk,Math.max(0,(await tx.get(gk)||0)-1))});
  this.requestReads=new Map();this.assetReadCount=0;
  try{
  this.stage='bootstrap';await this.loadBootstrap();
  let normalizedQuestion=question.replace(/簑釉龍|簑鮋龍|蓑釉龍/g,'蓑鮋龍');
  let plan=null;
  if(this.env.CONVERSATION_PLANNER==='true'){
   this.stage='intent';
   const priorTurns=previous.questions.slice(-6).map((user,i)=>({user,assistant:previous.answers.slice(-previous.questions.slice(-6).length)[i]||''}));
   const intentKey='cache:intent:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ANSWER_CACHE_VERSION+uid+JSON.stringify(priorTurns)+JSON.stringify(priorIntent)+normalizedQuestion)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const rememberedIntent=await this.storage.get(intentKey);
   if(rememberedIntent?.expires>Date.now()&&validIntent(rememberedIntent.plan))plan=rememberedIntent.plan;
   else{
   const intent=await this.model(INTENT_POLICY+'\n'+JSON.stringify({priorTurns,priorIntent,question:normalizedQuestion}),validIntent,{schema:INTENT_SCHEMA,maxTokens:500,temperature:0});
   if(!intent){await release();const state=await this.availability();return {status:503,body:{error:state.message,code:state.code,retryAt:state.retryAt,providers:state.providers,lastFailures:state.lastFailures}}}
   plan=parseModelValue(intent.value);await this.storage.put(intentKey,{plan,expires:Date.now()+86400000});
   }
   normalizedQuestion=plan.query;
  }
  this.stage='retrieval';const search=await retrieveMany(this.manifest,[normalizedQuestion,...(plan?.queries||[])],file=>this.read(file),{advanced:plan?.progress==='advanced',list:plan?.mode==='list'});const current=search.facts;
  const contextual=!plan&&previous.context?await retrieve(this.manifest,previous.context+' '+normalizedQuestion,file=>this.read(file)):[];
  // Unnamed conversational requests also get playable facts. The model can
  // infer intent without a growing list of hard-coded recommendation phrases.
  const hasNamedSubject=!(plan?.mode==='recommendation'&&plan.facet==='none')&&((search.coverage.subjects||[]).length>0||Object.keys(this.manifest._entities||{}).some(name=>normalizedQuestion.toLowerCase().includes(name)));
  const playable=hasNamedSubject||plan&&plan.mode!=='recommendation'?[]:await activityPool(this.manifest,normalizedQuestion,file=>this.read(file),{advanced:plan?.progress==='advanced'});
  this.stage='translations';await this.loadTranslations();
  this.stage='playbook';this.playbook??=this.bootstrap?.playbook||await this.read('player-playbook.json').catch(()=>[]);
  this.stage='gameplay';this.gameplay??=this.bootstrap?.gameplay||await (async()=>{
    try{
      const index=await this.read('gameplay-knowledge-index.json');
      const pages=await Promise.all((index.shards||[]).map(x=>this.read(x.file)));
      return pages.flat();
    }catch{return []}
  })();
  const q=(plan?plan.query:previous.context+' '+previous.questions.slice(-3).join(' ')+' '+question).toLowerCase().replace(/簑釉龍|簑鮋龍|蓑釉龍/g,'蓑鮋龍');
  const flying=/飛|flight/.test(q)&&!/(?:不用|不必|不需要|不要|不要求).{0,3}飛|地面就好/.test(question),rideable=/騎|坐騎|ride/.test(q),buildings=/建築|房子|原木|木屋|自然.*沒關係/.test(q);
  const activity=/無聊|幹嘛|做什麼|做啥|做點|能做|有什麼.*做|想.*做|玩什麼|推薦|下一步|沒事|不知道.*做|what.*do|bored/.test(q);
  const dragonTerrain=/(龍|dragon).*(破壞|地形|拆|燒|火|安全|grief|terrain|destroy|break)|(?:破壞|地形|grief|terrain).*(龍|dragon)/i.test(q);
  const queryTerms=(()=>{
    const topic=normalizedQuestion.toLowerCase();
    const out=new Set(topic.split(/[\s，。！？、,.!?/()：:；;「」『』【】\[\]]+/).filter(x=>x.length>=2));
    for(const seq of topic.match(/[\u3400-\u9fff]{2,}/g)||[]){
      const max=Math.min(seq.length,24);
      for(let n=2;n<=4;n++)for(let i=0;i+n<=max;i++)out.add(seq.slice(i,i+n));
    }
    return [...out].slice(0,160);
  })();
  const rank=f=>{
    const hay=(f.title+' '+f.search+' '+(f.labels||[]).join(' ')+' '+f.playerSummary).toLowerCase();
    let score=0;
    for(const t of queryTerms)if(hay.includes(t))score+=t.length>=4?3:t.length===3?2:1;
    if(hay.includes(normalizedQuestion.toLowerCase()))score+=20;
    if(f.category==='activity'&&activity)score+=6;
    if(dragonTerrain&&/龍|dragon/i.test(normalizedQuestion)&&f.category==='dragon-behavior')score+=24;
    if(flying&&/龍|飛|騎/i.test(normalizedQuestion)&&/會飛|飛行|可騎|坐騎/.test(hay))score+=22;
    if(buildings&&/龍|原木|木屋|建築安全/i.test(normalizedQuestion)&&/原木建築|相連原木|建築安全/.test(hay))score+=36;
    if(flying&&f.id==='playbook:dragon-terrain-berk-safe')score-=20;
    return score;
  };
  const curated=(this.playbook||[]).map(f=>({f,score:rank(f)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,activity?8:6).map(x=>x.f).filter(f=>!flying||!['playbook:dragon-terrain-berk-safe','playbook:dragon-terrain-berk-matrix'].includes(f.id));
  const broad=(this.gameplay||[]).filter(f=>!plan||plan.facet!=='companions'||hasNamedSubject||f.category==='companions').filter(f=>!hasNamedSubject||search.coverage.subjects.some(n=>(f.title+' '+f.search+' '+(f.labels||[]).join(' ')).toLowerCase().includes(n))).map(f=>({f,score:rank(f)||(!hasNamedSubject&&plan?.facet==='companions'?1:0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,plan?.mode==='list'?48:12).map(x=>x.f);
  const candidates=[];
  if(plan?.mode==='list'&&!['drops','bossDrops'].includes(plan.facet)&&broad.length>4){
   const names=broad.filter(f=>f.kind==='collection'||f.kind==='inventory');
   const entries=[];let listBytes=0;for(const f of names){const entry=(f.playerTitle||f.title)+'：'+f.playerSummary;const size=new TextEncoder().encode(entry).length;if(listBytes+size>5500)continue;entries.push(entry);listBytes+=size}
   if(entries.length)candidates.push({id:'list:gameplay',title:'本輪相關圖鑑條目',playerTitle:'相關圖鑑名稱與條件查核',playerSummary:'本輪搜尋找到 '+names.length+' 個相關圖鑑條目；本次保留 '+entries.length+' 項的完整摘要。相關不代表已符合玩家全部條件，必須逐項核對，未保留的条目不能據此判定不存在。\n'+entries.join('\n'),source:'目前整合包圖鑑資料',shard:'gameplay-knowledge-index.json',labels:plan.focus});
  }
  if(plan&&['drops','bossDrops'].includes(plan.facet)){this.stage='relations';this.relations??=await this.read('relation-knowledge.json');const evidence=relationEvidence(this.relations,plan);if(evidence)candidates.push(evidence)}
  if(!hasNamedSubject&&plan?.facet==='companions'&&plan.mode!=='mechanism')for(const f of broad)if(f.playerSummary)candidates.push(f);
  const activityGuides=new Map((this.gameplay||[]).filter(f=>f.kind==='article').map(f=>[f.id,f]));
  const completeActivity=f=>{const guide=f.id.startsWith('activity-')&&activityGuides.get('article:'+f.article);return guide?.playerSummary?{...f,playerSummary:guide.playerSummary,source:guide.source}:f};
  const currentPlayer=current.filter(f=>f.playerSummary).map(completeActivity),contextPlayer=contextual.filter(f=>f.playerSummary).map(completeActivity),broadPlayer=broad.filter(f=>f.playerSummary);
  const playablePlayer=playable.map(completeActivity);
  if(plan?.mode==='recommendation')for(const f of playablePlayer)candidates.push(f);
  // Keep direct, prior-topic and playable instructions in the bounded pool.
  // Raw manual categories must not crowd out concrete player instructions.
  for(const f of [...curated.filter(f=>f.category!=='activity'&&(!plan||plan.mode==='mechanism'||plan.facet==='none'&&plan.mode!=='acquisition')),...currentPlayer.slice(0,2),...current.filter(f=>f.runtimeEvidence&&(hasNamedSubject||!plan||plan.mode==='mechanism')).slice(0,3),...playablePlayer.slice(0,3),...contextPlayer.slice(0,2),...broadPlayer.slice(0,2),...curated.filter(f=>f.category==='activity'&&(!plan||plan.mode==='recommendation')).slice(0,2),...currentPlayer.slice(2),...playablePlayer.slice(3),...broadPlayer.slice(2),...contextPlayer.slice(2)])if(!candidates.some(x=>x.id===f.id))candidates.push(f);
  for(let i=0;i<18;i++){for(const f of [current[i],contextual[i]])if(f&&!candidates.some(x=>x.id===f.id))candidates.push(f)}
  const remember=async (facts,answer='')=>{if(conversationKey)await this.storage.put(conversationKey,{questions:[...previous.questions,question].slice(-4),answers:[...previous.answers,String(answer||'')].slice(-4),intent:plan,context:facts.map(f=>f.title+' '+(f.labels||[]).join(' ')).join(' ').slice(0,1800),expires:Date.now()+86400000})};
  if(!candidates.length&&!plan){await release();return {status:200,body:{facts:[],message:'目前解包索引沒有找到依據。請改用物品名稱或模組名稱搜尋。'}}};
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ANSWER_CACHE_VERSION+this.manifest.version+uid+JSON.stringify(previous.questions)+JSON.stringify(previous.answers)+previous.context+JSON.stringify(priorIntent)+question.toLowerCase())))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const cacheKey='cache:'+digest,cached=await this.storage.get(cacheKey);
   if(cached&&cached.expires>Date.now()){await remember(cached.body.facts,cached.body.answer);return {status:200,body:{...cached.body,remaining:slot.remaining}}};
   const sent=[],compact=[],seen=new Set();let bytes=0;for(const f of candidates){if(f.id.startsWith('playbook:dragon-terrain-berk-')&&sent.some(x=>x.id==='playbook:dragon-terrain-berk-matrix'))continue;if(f.id==='playbook:dragon-terrain-berk-matrix'&&sent.some(x=>x.id.startsWith('playbook:dragon-terrain-berk-')))continue;const evidence=modelEvidence(f);const signature=evidence.text.replace(/\s/g,'');if(!signature||seen.has(signature))continue;seen.add(signature);const entry={id:String(sent.length+1),title:this.localize(evidence.title),text:this.localize(evidence.text),sourceRef:f.source||'',evidenceScope:f.evidenceScope||'已收錄資料，須按實際內容核對',versionHash:f.sha256||null};const size=new TextEncoder().encode(JSON.stringify(entry)).length;if(bytes+size>9000)continue;sent.push(f);compact.push(entry);bytes+=size;if(sent.length>=8)break}
   if(!sent.length&&!plan){await release();return {status:200,body:{facts:[],message:'目前沒有足夠的資料確認這個問題，可以換個物品名稱問問看。'}}}
    const supplement=async queries=>{
     this.stage='supplemental-evidence';const topic=(plan?.focus||[]).join(' ').slice(0,70)||normalizedQuestion.slice(0,70),additional=await retrieveMany(this.manifest,queries.map(q=>topic+' '+normalizedQuestion.slice(0,60)+' '+q),file=>this.read(file),{related:true});
     const retained=[];let reserved=0;for(const f of [...current.filter(f=>f.runtimeEvidence&&f.actionScore),...sent].slice(0,1)){const size=new TextEncoder().encode(JSON.stringify(modelEvidence(f))).length;if(retained.length&&reserved+size>4500)break;retained.push(f);reserved+=size}
     const pool=[...retained,...additional.facts,...sent],ids=new Set();sent.splice(0);compact.splice(0);let total=0;
     for(const f of pool){const key=f.definitionKey||f.id;if(ids.has(key))continue;ids.add(key);const evidence=modelEvidence(f),entry={id:String(sent.length+1),title:this.localize(evidence.title),text:this.localize(evidence.text),sourceRef:f.source||'',evidenceScope:f.evidenceScope||'已收錄資料，須按實際內容核對',versionHash:f.sha256||null},size=new TextEncoder().encode(JSON.stringify(entry)).length;if(!entry.text||total+size>9000)continue;sent.push(f);compact.push(entry);total+=size;if(sent.length>=8)break}
     search.coverage.supplemental=additional.coverage;
    };
    const references=hasNamedSubject&&plan?.mode!=='chat'?referenceQueries(current,normalizedQuestion):[];
    if(references.length)await supplement(references);
   const requestedConstraints={flying,rideable,buildings,naturalChangesAllowed:/自然.*(?:沒關係|可以|不介意)/.test(q)};
   const prompt=CHAT_POLICY+'\n\n'+MECHANICS_POLICY+'\n'+JSON.stringify({priorTurns:previous.questions.slice(-3).map((q,i)=>({user:q,assistant:previous.answers.slice(-previous.questions.slice(-3).length)[i]||''})),question,conversationIntent:plan,requestedConstraints,retrievalCoverage:search.coverage,facts:compact});
   this.stage='provider';let reply=await this.model(prompt,value=>{const parsed=parseModelValue(value);return typeof parsed?.answer==='string'&&parsed.answer.trim().length>0&&parsed.answer.length<=1600&&Array.isArray(parsed.factIds)&&parsed.factIds.length<=4&&parsed.factIds.every(id=>Number(id)>=1&&Number(id)<=sent.length&&/^\d+$/.test(String(id)))});
   if(!reply){await release();const availability=await this.availability();return {status:503,body:{error:availability.message,code:availability.code,retryAt:availability.retryAt,providers:availability.providers,lastFailures:availability.lastFailures}}}
   if(this.env.ANSWER_REVIEW==='true'&&plan&&plan.mode!=='chat'&&compact.length){
    const validateReview=value=>{const x=parseModelValue(value);return typeof x?.answer==='string'&&x.answer.trim()&&x.answer.length<=1600&&Array.isArray(x.factIds)&&x.factIds.length<=3&&x.factIds.every(id=>/^\d+$/.test(String(id))&&Number(id)>=1&&Number(id)<=sent.length)&&(x.searchQueries===undefined||Array.isArray(x.searchQueries)&&x.searchQueries.length<=3&&x.searchQueries.every(q=>typeof q==='string'&&q.trim()&&q.length<=100))};
    for(let pass=0;pass<2;pass++){
     this.stage='answer-review';const reviewed=await this.model(REVIEW_POLICY+'\n'+JSON.stringify({priorTurns:previous.questions.slice(-3).map((user,i)=>({user,assistant:previous.answers.slice(-previous.questions.slice(-3).length)[i]||''})),question,conversationIntent:plan,retrievalCoverage:search.coverage,searchBudgetRemaining:search.coverage.supplemental?0:1-pass,facts:compact,draft:parseModelValue(reply.value)}),validateReview,{schema:REVIEW_SCHEMA,maxTokens:800,temperature:0.3});
     if(!reviewed){await release();const state=await this.availability();return {status:503,body:{error:state.message,code:state.code,retryAt:state.retryAt,providers:state.providers,lastFailures:state.lastFailures}}}
     reply=reviewed;const extra=parseModelValue(reviewed.value).searchQueries;
     if(pass||!extra?.length||search.coverage.supplemental)break;
     const oldFacts=sent.map(f=>f.id),draft=parseModelValue(reply.value);await supplement(extra);
     reply={...reply,value:{...draft,factIds:draft.factIds.map(id=>sent.findIndex(f=>f.id===oldFacts[Number(id)-1])+1).filter(id=>id>0).map(String)}};
    }
   }
   const parsed=selectedReply(reply.value,sent.map((f,i)=>({...f,id:String(i+1)})));
   const facts=parsed.facts.map(({search,...f})=>this.localizeFact({...f,id:sent[Number(f.id)-1].id}));
   parsed.answer=this.localize(parsed.answer);
   if(!parsed.answer){await release();return {status:200,body:{facts:[],answer:'目前資料不足以可靠回答這題。',message:'目前資料不足以可靠回答這題。'}}}
   if(!facts.length){await remember([],parsed.answer);return {status:200,body:{facts:[],answer:parsed.answer,message:parsed.answer,provider:reply.provider,version:this.manifest.version,intent:plan,remaining:slot.remaining}}}
   const body={facts,answer:parsed.answer,provider:reply.provider,version:this.manifest.version,message:parsed.answer,intent:plan};
   await this.storage.put(cacheKey,{body,expires:Date.now()+86400000});await remember(facts,parsed.answer);return {status:200,body:{...body,remaining:slot.remaining}};
  }catch(error){await release();throw error}finally{this.requestReads=null}
 }
}
