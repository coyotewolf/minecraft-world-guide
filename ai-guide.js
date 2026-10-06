import {retrieve} from './ai-search.js';
import {playerEvidence} from './ai-evidence.js';

let auth,identity,host,controller,manifest,state,busy=false,cloudReady=false,history=[],translationMap=null,translationMatchers=[];
const storageKey=uid=>'aoi-assistant:'+uid;
const migrationKey=uid=>'aoi-assistant-cloud-migrated:'+uid;
function newConversationId(){if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=bytes[6]&15|64;bytes[8]=bytes[8]&63|128;const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-')}
function nowIso(){return new Date().toISOString()}
function normalizeMessage(m,i=0){return {id:m.id||newConversationId(),role:m.role==='user'?'user':'assistant',text:String(m.text||''),facts:Array.isArray(m.facts)?m.facts:[],created_at:m.created_at||new Date(Date.now()+i).toISOString()}}
export function cancelAiGuide(){controller?.abort();busy=false}
function load(uid){
 try{
  const saved=JSON.parse(localStorage.getItem(storageKey(uid)));
  if(saved?.conversationId&&Array.isArray(saved.messages))return {...saved,messages:saved.messages.map(normalizeMessage).slice(-60)}
 }catch{}
 return {conversationId:newConversationId(),messages:[],oldestAt:null,hasEarlier:false}
}
function save(){
 try{localStorage.setItem(storageKey(identity),JSON.stringify({...state,messages:state.messages.slice(-60)}))}
 catch{state.messages=state.messages.slice(-20);try{localStorage.setItem(storageKey(identity),JSON.stringify(state))}catch{}}
}
const $=s=>host.querySelector(s);
async function loadTranslations(){
 if(translationMap)return translationMap;
 try{
  const index=await fetch('data/ai/translation-registry-index.json').then(r=>{if(!r.ok)throw Error();return r.json()});
  const pages=await Promise.all((index.shards||[]).map(file=>fetch('data/ai/'+file).then(r=>{if(!r.ok)throw Error();return r.json()})));
  translationMap=Object.assign({},...pages);
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\const $=s=>host.querySelector(s);
');');
  const keys=Object.keys(translationMap).filter(x=>x.length>=2).sort((a,b)=>b.length-a.length);
  translationMatchers=[];
  for(let i=0;i<keys.length;i+=700){const group=keys.slice(i,i+700).map(escape).join('|');translationMatchers.push(new RegExp('(?<![A-Za-z0-9_])(?:'+group+')(?![A-Za-z0-9_])','g'))}
 }catch{translationMap={};translationMatchers=[]}
 return translationMap;
}
function localizeText(text){if(typeof text!=='string'||!translationMap)return text;let out=text;for(const re of translationMatchers)out=out.replace(re,m=>translationMap[m]||m);return out}
function localizeFact(f){if(!f)return f;const copy={...f};for(const k of ['title','playerTitle','playerSummary','text'])if(typeof copy[k]==='string')copy[k]=localizeText(copy[k]);if(Array.isArray(copy.labels))copy.labels=copy.labels.map(localizeText);return copy}
function factsView(facts){const {h}=auth;if(!(facts||[]).length)return '';return `<div class="assistant-sources"><details><summary>查看來源${facts.length>1?`（${facts.length}）`:''}</summary>${facts.map(raw=>{const f=localizeFact(raw),shown=playerEvidence(f);return `<article class="assistant-fact assistant-fact-compact"><h3>${h(shown.title)}</h3><p class="assistant-source-label">${h(localizeText(f.source)||'本站查核資料')}</p><p>${h(shown.text)}</p>${f.shard?`<a href="data/ai/${h(f.shard)}" target="_blank" rel="noopener">原始資料 ↗</a>`:''}</article>`}).join('')}</details></div>`}
function updateHistoryControl(){
 const select=$('#assistant-history');
 if(!select)return;
 const selected=state?.conversationId;
 const options=history.map(c=>`<option value="${c.id}"${c.id===selected?' selected':''}>${auth.h(c.title||'新對話')}</option>`).join('');
 select.innerHTML=options||`<option value="${selected||''}">目前對話</option>`;
 select.disabled=busy||!cloudReady||history.length<2;
}
function paint(){
 const {h}=auth;
 $('#assistant-messages').innerHTML=state.messages.length?state.messages.map(m=>`<div class="assistant-message ${m.role==='user'?'from-player':'from-helper'}">${m.text?`<p>${h(m.text)}</p>`:''}${factsView(m.facts)}</div>`).join(''):'<div class="assistant-message from-helper"><p>想找材料、比較龍、規劃下一步，或只是想找點事做，都可以直接問我。</p></div>';
 const messages=$('#assistant-messages');messages.scrollTop=messages.scrollHeight;
 $('#assistant-send').disabled=busy||!auth.active||!auth.cfg.aiEndpoint;
 $('#assistant-search').disabled=busy;
 $('#assistant-new').disabled=busy;
 $('#assistant-more').hidden=!state.hasEarlier;
 $('#assistant-more').disabled=busy||!cloudReady;
 $('#assistant-status').textContent=busy?'小助手正在查資料…':!auth.active?'登入玩家帳號後可使用 AI 與跨裝置聊天紀錄；搜尋仍可直接使用。':cloudReady?'聊天紀錄已同步到帳號。':'正在同步聊天紀錄…';
 updateHistoryControl();
}
export function openAssistant(){if(!host)return;$('#assistant-window').hidden=false;$('#assistant-launcher').setAttribute('aria-expanded','true');$('#assistant-input').focus()}
function closeAssistant(){$('#assistant-window').hidden=true;$('#assistant-launcher').setAttribute('aria-expanded','false');$('#assistant-launcher').focus()}
function cloudEnabled(){return identity!=='guest'&&auth?.active&&auth?.db}
async function refreshHistory(){
 if(!cloudEnabled())return;
 const owner=identity;
 const {data,error}=await auth.db.from('assistant_conversations').select('id,title,created_at,updated_at').eq('user_id',owner).order('updated_at',{ascending:false}).limit(30);
 if(error)throw error;
 if(identity!==owner)return;
 history=data||[];updateHistoryControl();
}
async function ensureConversation(title){
 if(!cloudEnabled())return;
 const owner=identity,id=state.conversationId;
 const clean=(title||'新對話').trim().slice(0,80)||'新對話';
 const {data,error}=await auth.db.from('assistant_conversations').select('id').eq('id',id).eq('user_id',owner).maybeSingle();
 if(error)throw error;
 if(!data){
  const created=state.messages[0]?.created_at||nowIso();
  const inserted=await auth.db.from('assistant_conversations').insert({id,user_id:owner,title:clean,created_at:created,updated_at:nowIso()});
  if(inserted.error)throw inserted.error;
 }
}
async function cloudMessage(message){
 if(!cloudEnabled())return;
 const owner=identity;
 const row={id:message.id,conversation_id:state.conversationId,user_id:owner,role:message.role,text:message.text||'',facts:message.facts||[],created_at:message.created_at||nowIso()};
 const result=await auth.db.from('assistant_messages').insert(row);
 if(result.error&&result.error.code!=='23505')throw result.error;
 await auth.db.from('assistant_conversations').update({updated_at:nowIso()}).eq('id',state.conversationId).eq('user_id',owner);
}
async function migrateLocal(){
 if(!cloudEnabled()||localStorage.getItem(migrationKey(identity))==='1'||!state.messages.length)return;
 const owner=identity;
 state.messages=state.messages.map(normalizeMessage);save();
 await ensureConversation(state.messages.find(m=>m.role==='user')?.text?.slice(0,80)||'先前對話');
 for(const message of state.messages){
  if(identity!==owner)return;
  await cloudMessage(message);
 }
 localStorage.setItem(migrationKey(owner),'1');
}
async function loadCloudConversation(id,prepend=false){
 if(!cloudEnabled())return;
 const owner=identity;
 let query=auth.db.from('assistant_messages').select('id,role,text,facts,created_at').eq('user_id',owner).eq('conversation_id',id).order('created_at',{ascending:false}).limit(30);
 if(prepend&&state.oldestAt)query=query.lt('created_at',state.oldestAt);
 const {data,error}=await query;
 if(error)throw error;
 if(identity!==owner)return;
 const batch=(data||[]).reverse().map(normalizeMessage);
 if(prepend){
  const known=new Set(state.messages.map(m=>m.id));
  state.messages=[...batch.filter(m=>!known.has(m.id)),...state.messages];
 }else{
  state={conversationId:id,messages:batch,oldestAt:null,hasEarlier:false};
 }
 state.oldestAt=state.messages[0]?.created_at||null;
 state.hasEarlier=(data||[]).length===30;
 save();paint();
}
async function hydrateCloud(){
 if(!cloudEnabled()){cloudReady=false;paint();return}
 const owner=identity;
 try{
  await migrateLocal();
  await refreshHistory();
  if(identity!==owner)return;
  const exists=history.find(c=>c.id===state.conversationId);
  if(!exists&&history[0])await loadCloudConversation(history[0].id);
  else if(exists)await loadCloudConversation(exists.id);
  cloudReady=true;paint();
 }catch(e){
  if(identity===owner){cloudReady=false;$('#assistant-status').textContent='聊天紀錄同步失敗，這台裝置仍會保留本機紀錄。';console.warn('assistant sync',e)}
 }
}
async function switchConversation(id){
 if(!id||id===state.conversationId)return;
 cancelAiGuide();busy=true;paint();
 try{await loadCloudConversation(id)}catch(e){$('#assistant-status').textContent='載入對話失敗：'+e.message}finally{busy=false;paint()}
}
async function newChat(){
 cancelAiGuide();state={conversationId:newConversationId(),messages:[],oldestAt:null,hasEarlier:false};save();paint();$('#assistant-input').focus()
}
export function syncAssistant(options){
 auth=options;const uid=options.user?.id||'guest';
 if(host&&uid===identity){paint();if(cloudEnabled()&&!cloudReady)void hydrateCloud();return}
 cancelAiGuide();identity=uid;cloudReady=false;history=[];state=load(uid);host?.remove();host=document.createElement('aside');host.id='assistant-host';document.body.append(host);
 host.innerHTML=`<button id="assistant-launcher" aria-expanded="false" aria-controls="assistant-window"><span aria-hidden="true">✦</span> 問問小助手</button><section id="assistant-window" role="dialog" aria-labelledby="assistant-title" hidden><header class="assistant-header"><h2 id="assistant-title">問問小助手</h2><div><button id="assistant-new" title="開始新對話" aria-label="開始新對話">＋</button><button id="assistant-close" aria-label="縮小聊天室">－</button></div></header><div class="assistant-history-row"><label for="assistant-history">對話</label><select id="assistant-history"><option>目前對話</option></select></div><button id="assistant-more" type="button" hidden>載入更早訊息</button><div id="assistant-messages" role="log" aria-live="polite"></div><p id="assistant-status" role="status"></p><form id="assistant-form"><label class="assistant-input-label" for="assistant-input">訊息</label><textarea id="assistant-input" maxlength="600" rows="2" placeholder="可以直接問比較、推薦、玩法、材料或取得方式…" required></textarea><div class="assistant-actions"><button id="assistant-search" type="button">搜尋</button><button id="assistant-send" class="primary" type="submit">傳送 ➤</button></div></form></section>`;
 $('#assistant-launcher').onclick=()=>$('#assistant-window').hidden?openAssistant():closeAssistant;
 $('#assistant-close').onclick=closeAssistant;
 $('#assistant-new').onclick=()=>void newChat();
 $('#assistant-history').onchange=e=>void switchConversation(e.target.value);
 $('#assistant-more').onclick=()=>void loadCloudConversation(state.conversationId,true);
 $('#assistant-form').onsubmit=e=>{e.preventDefault();send(true)};
 $('#assistant-search').onclick=()=>send(false);
 $('#assistant-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!$('#assistant-send').disabled)send(true)}};
 host.onkeydown=e=>{if(e.key==='Escape'&&!$('#assistant-window').hidden)closeAssistant()};
 paint();void hydrateCloud();void loadTranslations().then(()=>paint());
}
export function mountAiGuide(){openAssistant()}
async function send(ai){
 const question=$('#assistant-input').value.trim();if(!question||busy||ai&&(!auth.active||!auth.cfg.aiEndpoint))return;
 const owner=identity,snapshot=auth,conversationId=state.conversationId;controller=new AbortController();const signal=controller.signal;busy=true;
 const userMessage=normalizeMessage({role:'user',text:question,created_at:nowIso()});state.messages.push(userMessage);$('#assistant-input').value='';save();paint();
 try{
  if(ai&&cloudEnabled()){
   await ensureConversation(question.slice(0,80));await cloudMessage(userMessage);await refreshHistory();
  }
  let facts=[],text='';
  if(ai){
   const session=await snapshot.db.auth.getSession();if(identity!==owner||signal.aborted||state.conversationId!==conversationId)return;
   const token=session.data?.session?.access_token;if(!token||session.data.session.user.id!==owner)throw Error('請重新登入玩家帳號。');
   const response=await fetch(snapshot.cfg.aiEndpoint.replace(/\/$/,'')+'/ask',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({question,conversationId}),signal:AbortSignal.any([signal,AbortSignal.timeout(90000)])});
   const answer=await response.json();if(!response.ok)throw Error(answer.error||'小助手暫時無法回覆，試試搜尋。');
   facts=answer.facts||[];text=answer.answer||answer.message||(facts.length?'我找到相關資料，但目前無法整理成完整回答。':'目前資料不足以可靠回答這題。');
   if(identity===owner)host.dataset.provider=answer.provider||'none';
  }else{
   const read=async file=>{const r=await fetch('data/ai/'+file,{signal});if(!r.ok)throw Error('資料暫時無法讀取。');return r.json()};
   manifest??=await read('manifest.json');await loadTranslations();facts=await retrieve(manifest,question,read);facts=facts.slice(0,5).map(localizeFact);text=facts.length?'搜尋到這些資料：':'沒有找到資料，試試物品中文名或原文名。';
  }
  if(identity!==owner||signal.aborted||state.conversationId!==conversationId)return;
  const assistantMessage=normalizeMessage({role:'assistant',text,facts,created_at:nowIso()});state.messages.push(assistantMessage);state.messages=state.messages.slice(-60);save();
  if(ai&&cloudEnabled()){await cloudMessage(assistantMessage);await refreshHistory()}
 }catch(e){
  if(identity===owner&&!signal.aborted&&state.conversationId===conversationId){
   const assistantMessage=normalizeMessage({role:'assistant',text:e.name==='TimeoutError'?'等候較久，請稍後再試。':e.message,created_at:nowIso()});state.messages.push(assistantMessage);save();
   if(ai&&cloudEnabled())try{await cloudMessage(assistantMessage)}catch{}
  }
 }finally{if(identity===owner&&!signal.aborted){busy=false;paint()}}
}
