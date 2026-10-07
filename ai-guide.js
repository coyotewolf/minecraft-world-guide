import {retrieve} from './ai-search.js';
import {playerEvidence} from './ai-evidence.js';

let auth,identity,host,controller,manifest,state,busy=false,cloudReady=false,history=[],translationMap=null,translationMatchers=[],hydrating=false,syncWarning=false,retryQuestion=null,retryRequestId=null,historyEpoch=0,deleting=false,pendingDelete=null,statusNotice="",switching=false;
const storageKey=uid=>'aoi-assistant:'+uid;
const migrationKey=uid=>'aoi-assistant-cloud-migrated:'+uid;
function newConversationId(){if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=bytes[6]&15|64;bytes[8]=bytes[8]&63|128;const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-')}
function nowIso(){return new Date().toISOString()}
function normalizeMessage(m,i=0){return {id:m.id||newConversationId(),role:m.role==='user'?'user':'assistant',text:String(m.text||''),facts:Array.isArray(m.facts)?m.facts:[],synced:!!m.synced,created_at:m.created_at||new Date(Date.now()+i).toISOString()}}
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
document.addEventListener('pointerdown',e=>{if(host&&!e.target.closest('#assistant-host .assistant-history-row'))closeHistory()});
async function loadTranslations(){
 if(translationMap)return translationMap;
 try{
  const index=await fetch('data/ai/translation-registry-index.json').then(r=>{if(!r.ok)throw Error();return r.json()});
  const pages=await Promise.all((index.shards||[]).map(file=>fetch('data/ai/'+file).then(r=>{if(!r.ok)throw Error();return r.json()})));
  translationMap=Object.assign({},...pages);
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const keys=Object.keys(translationMap).filter(x=>x.length>=2).sort((a,b)=>b.length-a.length);
  translationMatchers=[];
  for(let i=0;i<keys.length;i+=700){const group=keys.slice(i,i+700).map(escape).join('|');translationMatchers.push(new RegExp('(?<![A-Za-z0-9_])(?:'+group+')(?![A-Za-z0-9_])','g'))}
 }catch{translationMap={};translationMatchers=[]}
 return translationMap;
}
function localizeText(text){if(typeof text!=='string'||!translationMap)return text;let out=text;for(const re of translationMatchers)out=out.replace(re,m=>translationMap[m]||m);return out}
function localizeFact(f){if(!f)return f;const copy={...f};for(const k of ['title','playerTitle','playerSummary','text'])if(typeof copy[k]==='string')copy[k]=localizeText(copy[k]);if(Array.isArray(copy.labels))copy.labels=copy.labels.map(localizeText);return copy}
function factsView(facts){const {h}=auth;if(!(facts||[]).length)return '';return `<div class="assistant-sources"><details><summary>查看來源${facts.length>1?`（${facts.length}）`:''}</summary>${facts.map(raw=>{const f=localizeFact(raw),shown=playerEvidence(f);return `<article class="assistant-fact assistant-fact-compact"><h3>${h(shown.title)}</h3><p class="assistant-source-label">${h(f.runtimeEvidence||/\.jar|Volitans|Entity|Projectile|Manager|Handler|Breath|FuryBolt/.test(f.source||'')?'目前整合包的模組資料與程式查核':localizeText(f.source)||'本站查核資料')}</p><p>${h(shown.text)}</p>${f.shard?`<a href="data/ai/${h(f.shard)}" target="_blank" rel="noopener">原始資料 ↗</a>`:''}</article>`}).join('')}</details></div>`}
function closeHistory(focus=false){$('#assistant-history-list').hidden=true;$('#assistant-history').setAttribute('aria-expanded','false');if(focus)$('#assistant-history').focus()}
function toggleHistory(){const list=$('#assistant-history-list');list.hidden=!list.hidden;$('#assistant-history').setAttribute('aria-expanded',String(!list.hidden))}
function updateHistoryControl(){
 const toggle=$('#assistant-history'),list=$('#assistant-history-list');if(!toggle)return;
 const selected=state.conversationId,locked=busy||switching||deleting||hydrating||!!pendingDelete;
 $('#assistant-history-title').textContent=history.find(c=>c.id===selected)?.title||'新對話';
 toggle.disabled=locked||!cloudReady||!history.length;
 if(toggle.disabled)closeHistory();
 const entries=history.some(c=>c.id===selected)?history:[{id:selected,title:'新對話',draft:true},...history];
 const top=list.scrollTop,focus=document.activeElement,focusId=focus?.dataset?.openConversation||focus?.dataset?.deleteConversation,focusAction=focus?.hasAttribute('data-delete-conversation')?'deleteConversation':'openConversation';
 list.innerHTML=entries.map(c=>`<div class="assistant-history-entry"${c.id===selected?' data-current="true"':''}><button type="button" class="assistant-history-open" data-open-conversation="${auth.h(c.id)}"${c.id===selected?' aria-current="true"':''}${locked?' disabled':''} title="${auth.h(c.title||'新對話')}">${auth.h(c.title||'新對話')}</button>${!c.draft?`<button type="button" class="assistant-history-delete" data-delete-conversation="${auth.h(c.id)}" aria-label="刪除對話：${auth.h(c.title||'新對話')}" title="刪除這段對話"${locked?' disabled':''}>${trashIcon()}</button>`:''}</div>`).join('');
 list.scrollTop=top;
 if(focusId&&!list.hidden){const replacement=[...list.querySelectorAll('button')].find(x=>x.dataset[focusAction]===focusId);replacement?.focus({preventScroll:true})}
}
function paint(forceScroll=false){
 const oldLog=$('#assistant-messages'),oldTop=oldLog.scrollTop,nearBottom=oldLog.scrollHeight-oldTop-oldLog.clientHeight<80;
 $('#assistant-delete-panel').hidden=!pendingDelete;if(!pendingDelete)$('#assistant-delete-question').textContent='';
 const {h}=auth;
 $('#assistant-messages').innerHTML=state.messages.length?state.messages.map(m=>`<div class="assistant-message ${m.role==='user'?'from-player':'from-helper'}">${m.text?`<p>${h(m.text)}</p>`:''}${factsView(m.facts)}<button type="button" class="assistant-delete-message" data-delete-message="${h(m.id)}" aria-label="${m.role==='user'?'刪除這則提問':'刪除這則回覆'}" title="刪除訊息">${trashIcon()}</button></div>`).join(''):'<div class="assistant-message from-helper"><p>想找材料、比較龍、規劃下一步，或只是想找點事做，都可以直接問我。</p></div>';
 const messages=$('#assistant-messages');messages.scrollTop=forceScroll||nearBottom?messages.scrollHeight:oldTop;
 $('#assistant-send').disabled=busy||switching||deleting||!!pendingDelete||!auth.active||!auth.cfg.aiEndpoint;
 $('#assistant-new').disabled=busy||switching||deleting||!!pendingDelete;
 $('#assistant-delete').disabled=busy||switching||deleting||hydrating||(!state.messages.length&&!state.cloudKnown);
 for(const button of host.querySelectorAll('[data-delete-message]'))button.disabled=busy||switching||deleting||hydrating;
 $('#assistant-delete-confirm').disabled=deleting;
 $('#assistant-delete-cancel').disabled=deleting;
 $('#assistant-more').hidden=!state.hasEarlier;
 $('#assistant-more').disabled=busy||switching||deleting||!!pendingDelete||!cloudReady;
 $('#assistant-status').textContent=deleting?'正在刪除…':statusNotice?statusNotice:busy?'小助手正在查資料…':!auth.active?'登入玩家帳號後可使用 AI 與跨裝置聊天紀錄；也可使用網站上方的搜尋。':syncWarning?'聊天紀錄暫存這台裝置，連線恢復後會再同步。':cloudReady?'聊天紀錄已同步到帳號。':'正在同步聊天紀錄…';
 updateHistoryControl();
 $('#assistant-retry').hidden=!retryQuestion;
 $('#assistant-retry').disabled=busy||switching||deleting||!!pendingDelete;
}
export function openAssistant(){if(!host)return;$('#assistant-window').hidden=false;$('#assistant-launcher').setAttribute('aria-expanded','true');$('#assistant-input').focus();$('#assistant-messages').scrollTop=$('#assistant-messages').scrollHeight;if(!busy&&cloudEnabled())void hydrateCloud()}
function closeAssistant(){closeHistory();if(!deleting){pendingDelete=null;paint()}$('#assistant-window').hidden=true;$('#assistant-launcher').setAttribute('aria-expanded','false');$('#assistant-launcher').focus()}
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
  if(state.cloudKnown||state.messages.some(m=>m.synced)){
   const access=await auth.db.rpc('player_status');if(access.error||access.data?.active!==true)throw Error('請重新登入後同步聊天紀錄。');
   const deleted=Error('這段對話已從帳號刪除，請開始新對話。');deleted.code='conversation_deleted';throw deleted;
  }
  const created=state.messages[0]?.created_at||nowIso();
  const inserted=await auth.db.from('assistant_conversations').insert({id,user_id:owner,title:clean,created_at:created,updated_at:nowIso()});
  if(inserted.error)throw inserted.error;
 }
 if(identity===owner&&state.conversationId===id){state.cloudKnown=true;save()}
}
async function cloudMessage(message,conversationId=state.conversationId,owner=identity){
 if(!cloudEnabled())return;
 if(owner!==identity)return;
 const row={id:message.id,conversation_id:conversationId,user_id:owner,role:message.role,text:message.text||'',facts:message.facts||[],created_at:message.created_at||nowIso()};
 const result=await auth.db.from('assistant_messages').insert(row);
 if(result.error&&result.error.code!=='23505')throw result.error;
 message.synced=true;if(identity===owner&&state.conversationId===conversationId)save();
 await auth.db.from('assistant_conversations').update({updated_at:nowIso()}).eq('id',conversationId).eq('user_id',owner);
}
async function migrateLocal(){
 if(!cloudEnabled()||localStorage.getItem(migrationKey(identity))==='1')return;
 const pending=state.messages.filter(m=>!m.synced);if(!pending.length){localStorage.setItem(migrationKey(identity),'1');return}
 const owner=identity;
 state.messages=state.messages.map(normalizeMessage);save();
 await ensureConversation(state.messages.find(m=>m.role==='user')?.text?.slice(0,80)||'先前對話');
 for(const message of pending){
  if(identity!==owner)return;
  await cloudMessage(message);
 }
 localStorage.setItem(migrationKey(owner),'1');
}
async function loadCloudConversation(id,prepend=false,preserveView=false){
 if(!cloudEnabled())return;
 const owner=identity,epoch=++historyEpoch;
 let query=auth.db.from('assistant_messages').select('id,role,text,facts,created_at').eq('user_id',owner).eq('conversation_id',id).order('created_at',{ascending:false}).limit(30);
 if(prepend&&state.oldestAt)query=query.lt('created_at',state.oldestAt);
 const {data,error}=await query;
 if(error)throw error;
 if(identity!==owner||busy||epoch!==historyEpoch)return;
 const log=$('#assistant-messages'),oldHeight=log.scrollHeight,oldScroll=log.scrollTop;
 const batch=(data||[]).reverse().map(m=>normalizeMessage({...m,synced:true}));
 if(prepend){
  const known=new Set(state.messages.map(m=>m.id));
  state.messages=[...batch.filter(m=>!known.has(m.id)),...state.messages];
 }else{
  state={conversationId:id,messages:batch,oldestAt:null,hasEarlier:false,cloudKnown:true};
 }
 state.oldestAt=state.messages[0]?.created_at||null;
 state.hasEarlier=(data||[]).length===30;
 save();paint(!prepend&&!preserveView);if(prepend)log.scrollTop=oldScroll+log.scrollHeight-oldHeight;
}
async function hydrateCloud(){
 if(hydrating||busy||deleting||pendingDelete)return;hydrating=true;
 if(!cloudEnabled()){cloudReady=false;hydrating=false;paint();return}
 const owner=identity,cid=state.conversationId;let currentCloudExists=false;
 try{
  if(state.cloudKnown||state.messages.some(m=>m.synced)){
   const checked=await auth.db.from('assistant_conversations').select('id').eq('id',cid).eq('user_id',owner).maybeSingle();
   if(checked.error)throw checked.error;
   if(identity!==owner||state.conversationId!==cid||busy||deleting)return;
   currentCloudExists=!!checked.data;
   if(!checked.data){const access=await auth.db.rpc('player_status');if(access.error||access.data?.active!==true)throw Error('請重新登入後同步聊天紀錄。');if(identity!==owner||state.conversationId!==cid)return;state={conversationId:newConversationId(),messages:[],oldestAt:null,hasEarlier:false};retryQuestion=null;retryRequestId=null;save();await refreshHistory();cloudReady=true;syncWarning=false;statusNotice='這段對話已從帳號刪除。';paint();return}
  }
  await migrateLocal();
  if(identity!==owner||state.conversationId!==cid||busy)return;
  const pending=state.messages.filter(m=>!m.synced);
  if(pending.length){await ensureConversation(state.messages.find(m=>m.role==='user')?.text);for(const message of pending){if(identity!==owner||state.conversationId!==cid||busy)return;await cloudMessage(message,cid,owner)}}
  await refreshHistory();
  if(identity!==owner||state.conversationId!==cid||busy)return;
  const exists=history.find(c=>c.id===state.conversationId)||(currentCloudExists?{id:cid}:null);
  if(!exists&&history[0]&&!cloudReady&&!state.messages.length)await loadCloudConversation(history[0].id);
  else if(exists)await loadCloudConversation(exists.id,false,true);
  cloudReady=true;syncWarning=false;paint();
 }catch(e){
  if(identity===owner){cloudReady=false;syncWarning=true;paint()}
 }finally{hydrating=false;if(identity===owner)paint()}
}
async function switchConversation(id){
 closeHistory();if(deleting||!id||id===state.conversationId)return;pendingDelete=null;statusNotice='';retryQuestion=null;retryRequestId=null;
 cancelAiGuide();switching=true;paint();
 try{await loadCloudConversation(id)}catch(e){$('#assistant-status').textContent='載入對話失敗：'+e.message}finally{busy=false;switching=false;paint()}
}
async function newChat(){
 if(deleting)return;closeHistory();pendingDelete=null;statusNotice='';cancelAiGuide();historyEpoch++;retryQuestion=null;retryRequestId=null;state={conversationId:newConversationId(),messages:[],oldestAt:null,hasEarlier:false};save();paint();$('#assistant-input').focus()
}
function trashIcon(){return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>'}
function requestDeletion(kind,id){
 if(busy||deleting||switching||hydrating)return;
 const message=kind==='message'?state.messages.find(m=>m.id===id):null;if(kind==='message'&&!message)return;
 const cid=kind==='conversation'?(id||state.conversationId):state.conversationId;if(cid!==state.conversationId&&!history.some(c=>c.id===cid))return;
 closeHistory();pendingDelete={kind,id,owner:identity,conversationId:cid,activeConversationId:state.conversationId};statusNotice='';
 $('#assistant-delete-question').textContent=kind==='conversation'?('刪除「'+(history.find(c=>c.id===cid)?.title||'新對話')+'」及其中所有訊息？'):('刪除這則訊息？「'+message.text.slice(0,70)+(message.text.length>70?'…':'')+'」');
 paint();$('#assistant-delete-cancel').focus();
}
async function deleteSelection(){
 const target=pendingDelete;if(!target||deleting||busy)return;
 const {owner,conversationId:cid,activeConversationId:activeId}=target;if(identity!==owner||state.conversationId!==activeId){pendingDelete=null;paint();return}
 const snapshot=auth,hadCloud=owner!=='guest';deleting=true;historyEpoch++;paint();
 try{
  if(hadCloud){
   if(!cloudEnabled())throw Error('請登入玩家帳號後再刪除帳號聊天紀錄。');
   const {data,error}=await snapshot.db.auth.getSession();if(error)throw error;
   const session=data?.session;if(!session?.access_token||session.user.id!==owner)throw Error('請重新登入後再刪除。');
   if(identity!==owner||state.conversationId!==activeId)return;
   if(!snapshot.cfg.aiEndpoint)throw Error('目前無法同步清除對話，請稍後再試。');
   const response=await fetch(snapshot.cfg.aiEndpoint.replace(/\/$/,'')+'/forget',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({conversationId:cid}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('目前無法同步清除對話，請稍後再試。');
   if(identity!==owner||state.conversationId!==activeId)return;
   if(target.kind==='message'&&state.messages.find(m=>m.id===target.id)?.role==='user'){
    const title=state.messages.find(m=>m.id!==target.id&&m.role==='user')?.text.trim().slice(0,80)||'新對話';
    const renamed=await snapshot.db.from('assistant_conversations').update({title,updated_at:nowIso()}).eq('user_id',owner).eq('id',cid);
    if(renamed.error)throw renamed.error;const entry=history.find(c=>c.id===cid);if(entry)entry.title=title;
   }
   let query=snapshot.db.from(target.kind==='conversation'?'assistant_conversations':'assistant_messages').delete().eq('user_id',owner);
   query=target.kind==='conversation'?query.eq('id',cid):query.eq('conversation_id',cid).eq('id',target.id);
   const result=await query.select('id');if(result.error)throw result.error;
   if(!result.data?.length){const checked=await snapshot.db.rpc('player_status');if(checked.error||checked.data?.active!==true)throw Error('請重新登入後再刪除。')}
  }
  if(identity!==owner||state.conversationId!==activeId)return;
  if(cid===activeId){retryQuestion=null;retryRequestId=null}
  if(target.kind==='conversation'){history=history.filter(c=>c.id!==cid);if(cid===activeId)state={conversationId:newConversationId(),messages:[],oldestAt:null,hasEarlier:false}}
  else{state.messages=state.messages.filter(m=>m.id!==target.id);state.oldestAt=state.messages[0]?.created_at||null}
  save();pendingDelete=null;statusNotice=target.kind==='conversation'?'對話已刪除。':'訊息已刪除。';
 }catch(e){if(identity===owner&&state.conversationId===activeId){pendingDelete=null;statusNotice='未能確認刪除完成，本機紀錄暫時保留。'+(e.message?.startsWith('請')?e.message:'請確認連線後重試。')}}
 finally{if(identity===owner){deleting=false;paint();$('#assistant-input').focus()}}
}
export function syncAssistant(options){
 auth=options;const uid=options.user?.id||'guest';
 if(host&&uid===identity){paint();if(cloudEnabled()&&!cloudReady)void hydrateCloud();return}
 cancelAiGuide();historyEpoch++;deleting=false;switching=false;pendingDelete=null;statusNotice='';identity=uid;cloudReady=false;syncWarning=false;retryQuestion=null;history=[];state=load(uid);host?.remove();host=document.createElement('aside');host.id='assistant-host';document.body.append(host);
 host.innerHTML=`<button id="assistant-launcher" aria-expanded="false" aria-controls="assistant-window"><span aria-hidden="true">✦</span> 問問小助手</button><section id="assistant-window" role="dialog" aria-labelledby="assistant-title" hidden><header class="assistant-header"><h2 id="assistant-title">問問小助手</h2><div><button id="assistant-new" title="開始新對話" aria-label="開始新對話"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a3 3 0 0 1-3 3H9l-6 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/><path d="M12 7v7m-3.5-3.5h7"/></svg></button><button id="assistant-delete" type="button" title="刪除這段對話" aria-label="刪除這段對話">${trashIcon()}</button><button id="assistant-close" title="最小化聊天室" aria-label="縮小聊天室"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 17h14"/></svg></button></div></header><div class="assistant-history-row"><span id="assistant-history-label">對話</span><button id="assistant-history" type="button" aria-labelledby="assistant-history-label assistant-history-title" aria-expanded="false" aria-controls="assistant-history-list"><span id="assistant-history-title">新對話</span><span aria-hidden="true">⌄</span></button><div id="assistant-history-list" role="group" aria-label="對話清單" hidden></div></div><section id="assistant-delete-panel" aria-label="確認刪除聊天內容" hidden><p id="assistant-delete-question"></p><p class="assistant-delete-warning">刪除後無法復原。已使用的每日問答次數不會退回。</p><div class="assistant-delete-actions"><button id="assistant-delete-cancel" type="button">取消</button><button id="assistant-delete-confirm" type="button">刪除</button></div></section><button id="assistant-more" type="button" hidden>載入更早訊息</button><div id="assistant-messages" role="log" aria-live="polite"></div><p id="assistant-status" role="status"></p><form id="assistant-form"><label class="assistant-input-label" for="assistant-input">訊息</label><textarea id="assistant-input" maxlength="600" rows="2" placeholder="可以直接問比較、推薦、玩法、材料或取得方式…" required></textarea><div class="assistant-actions"><button id="assistant-retry" type="button" hidden>重試上個問題</button><button id="assistant-send" class="primary" type="submit">傳送 ➤</button></div></form></section>`;
 $('#assistant-launcher').onclick=()=>$('#assistant-window').hidden?openAssistant():closeAssistant();
 $('#assistant-close').onclick=closeAssistant;
 $('#assistant-delete').onclick=()=>requestDeletion('conversation');
 $('#assistant-delete-confirm').onclick=()=>void deleteSelection();
 $('#assistant-delete-cancel').onclick=()=>{pendingDelete=null;paint();$('#assistant-input').focus()};
 $('#assistant-messages').onclick=e=>{const button=e.target.closest('[data-delete-message]');if(button)requestDeletion('message',button.dataset.deleteMessage)};
 $('#assistant-retry').onclick=()=>{if(retryQuestion){$('#assistant-input').value=retryQuestion;send(true,true)}};
 $('#assistant-new').onclick=()=>void newChat();
 $('#assistant-history').onclick=toggleHistory;
 $('#assistant-history').onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();if($('#assistant-history-list').hidden)toggleHistory();$('#assistant-history-list button')?.focus()}};
 $('#assistant-history-list').onclick=e=>{const button=e.target.closest('button');if(!button||button.disabled)return;if(button.dataset.deleteConversation)requestDeletion('conversation',button.dataset.deleteConversation);else if(button.dataset.openConversation){void switchConversation(button.dataset.openConversation);$('#assistant-history').focus()}};
 $('#assistant-history-list').onkeydown=e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const buttons=[...$('#assistant-history-list').querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement);e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)))]?.focus()};
 host.addEventListener('focusout',e=>{if(!host.querySelector('.assistant-history-row').contains(e.relatedTarget))closeHistory()});
 host.addEventListener('pointerdown',e=>{if(!e.target.closest('.assistant-history-row'))closeHistory()});
 $('#assistant-more').onclick=()=>void loadCloudConversation(state.conversationId,true);
 $('#assistant-form').onsubmit=e=>{e.preventDefault();send(true)};
 $('#assistant-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!$('#assistant-send').disabled)send(true)}};
 host.onkeydown=e=>{if(e.key==='Escape'&&!$('#assistant-window').hidden){e.preventDefault();if(!$('#assistant-history-list').hidden)closeHistory(true);else closeAssistant()}};
 paint();void hydrateCloud();void loadTranslations().then(()=>paint());
}
export function mountAiGuide(){openAssistant()}
async function send(ai,retrying=false){
 const question=$('#assistant-input').value.trim();if(!question||busy||switching||deleting||pendingDelete||ai&&(!auth.active||!auth.cfg.aiEndpoint))return;
 statusNotice='';const owner=identity,snapshot=auth,conversationId=state.conversationId;controller=new AbortController();const signal=controller.signal;busy=true;
 const userMessage=normalizeMessage({role:'user',text:question,created_at:nowIso()});const requestId=retrying&&retryRequestId?retryRequestId:userMessage.id;if(!retrying)state.messages.push(userMessage);retryQuestion=null;$('#assistant-input').value='';save();paint(true);
 try{
  if(ai&&cloudEnabled()){
   try{await ensureConversation(question.slice(0,80));if(!retrying)await cloudMessage(userMessage,conversationId,owner);await refreshHistory()}catch(e){
    if(identity!==owner||state.conversationId!==conversationId||signal.aborted)return;
    if(e.code==='conversation_deleted'){history=history.filter(c=>c.id!==conversationId);state={conversationId:newConversationId(),messages:[],oldestAt:null,hasEarlier:false};retryQuestion=null;retryRequestId=null;statusNotice='這段對話已刪除，已為你開新對話。問題留在輸入框，可重新傳送。';save();$('#assistant-input').value=question;return}
    syncWarning=true;
   }
  }
  let facts=[],text='';
  if(ai){
   const session=await snapshot.db.auth.getSession();if(identity!==owner||signal.aborted||state.conversationId!==conversationId)return;
   const token=session.data?.session?.access_token;if(!token||session.data.session.user.id!==owner)throw Error('請重新登入玩家帳號。');
   const response=await fetch(snapshot.cfg.aiEndpoint.replace(/\/$/,'')+'/ask',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({question,conversationId,requestId}),signal:AbortSignal.any([signal,AbortSignal.timeout(90000)])});
   const answer=await response.json();if(!response.ok){if(identity===owner)host.dataset.availability=JSON.stringify({code:answer.code,diagnostic:answer.diagnostic,stage:answer.stage,providers:answer.providers,lastFailures:answer.lastFailures});const e=Error(answer.error||'小助手暫時無法回覆，試試搜尋。');e.retryAt=answer.retryAt;throw e}
   facts=answer.facts||[];text=answer.answer||answer.message||(facts.length?'我找到相關資料，但目前無法整理成完整回答。':'目前資料不足以可靠回答這題。');
   if(identity===owner){delete host.dataset.availability;host.dataset.provider=answer.provider||'none';host.dataset.intent=JSON.stringify(answer.intent||null)};
  }else{
   const read=async file=>{const r=await fetch('data/ai/'+file,{signal});if(!r.ok)throw Error('資料暫時無法讀取。');return r.json()};
   manifest??=await read('manifest.json');await loadTranslations();facts=await retrieve(manifest,question,read);facts=facts.slice(0,5).map(localizeFact);text=facts.length?'搜尋到這些資料：':'沒有找到資料，試試物品中文名或原文名。';
  }
  if(identity!==owner||signal.aborted||state.conversationId!==conversationId)return;
  const assistantMessage=normalizeMessage({role:'assistant',text,facts,created_at:nowIso()});state.messages.push(assistantMessage);state.messages=state.messages.slice(-60);save();
  if(ai&&cloudEnabled())try{await cloudMessage(assistantMessage,conversationId,owner);await refreshHistory()}catch{syncWarning=true}
 }catch(e){
  if(identity===owner&&!signal.aborted&&state.conversationId===conversationId){
   retryQuestion=question;retryRequestId=requestId;
   const retryNote=e.retryAt?' 可在 '+new Date(e.retryAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})+' 再試。':'';
   const assistantMessage=normalizeMessage({role:'assistant',text:(e.name==='TimeoutError'?'等候較久，請稍後再試。':e.message)+retryNote,created_at:nowIso()});state.messages.push(assistantMessage);save();
   if(ai&&cloudEnabled())try{await cloudMessage(assistantMessage,conversationId,owner)}catch{syncWarning=true}
  }
 }finally{if(identity===owner&&!signal.aborted){busy=false;paint(true)}}
}

window.addEventListener('focus',()=>{if(host&&!$('#assistant-window').hidden&&!busy)void hydrateCloud()});
window.addEventListener('online',()=>{if(host&&!busy)void hydrateCloud()});
