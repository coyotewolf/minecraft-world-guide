// Quota configuration lives with the existing coordinator, not chat history.
export const PLAYER_DEFAULT=50,GLOBAL_LIMIT=400,NEURON_BUDGET=8500;
export function qwenNeurons(usage){const input=usage?.prompt_tokens,output=usage?.completion_tokens;return Number.isInteger(input)&&input>0&&Number.isInteger(output)&&output>=0&&input<=1000000&&output<=100000?Math.ceil(input*4625/1e6+output*30475/1e6):null}
export const providerDay=(provider,now=Date.now())=>provider==='gemini'?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now):new Date(now).toISOString().slice(0,10);
export function providerReset(provider,now=Date.now()){const today=providerDay(provider,now);let low=now,high=now+36*3600000;while(high-low>1){const middle=Math.floor((low+high)/2);if(providerDay(provider,middle)===today)low=middle;else high=middle}return high}
export function quotaChange(value){
 if(!value||Object.keys(value).some(k=>!['userId','limit','geminiDailyLimit'].includes(k)))throw Error('設定格式無效。');
 if('userId' in value){if(Object.keys(value).length!==2||typeof value.userId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value.userId)||!('limit' in value)||value.limit!==null&&(!Number.isInteger(value.limit)||value.limit<0||value.limit>400))throw Error('玩家上限須為 0～400 的整數。');return {userId:value.userId,limit:value.limit}}
 if(Object.keys(value).length!==1||!('geminiDailyLimit' in value)||value.geminiDailyLimit!==null&&(!Number.isInteger(value.geminiDailyLimit)||value.geminiDailyLimit<1||value.geminiDailyLimit>100000))throw Error('請填寫已在 AI Studio 確認的每日請求上限。');
 return {geminiDailyLimit:value.geminiDailyLimit};
}
export async function playerLimit(storage,uid){return await storage.get('limit:'+uid)??PLAYER_DEFAULT}
export async function changeQuota(storage,change,adminId){
 const key=change.userId?'limit:'+change.userId:'config:geminiDailyLimit';
 const value=change.userId?change.limit:change.geminiDailyLimit;
 await storage.transaction(async tx=>{if(value===null)await tx.delete([key]);else await tx.put(key,value);await tx.put('quota-change:'+key,{adminId,at:Date.now(),value})});
}
export async function recordUsage(storage,provider,event,details={}){
 const key='usage:'+providerDay(provider)+':'+provider;
 await storage.transaction(async tx=>{const row=await tx.get(key)||{attempts:0,successes:0,errors:0,inputTokens:0,outputTokens:0,startedAt:Date.now()};
 if(event==='attempt')row.attempts++;
 if(event==='success'){row.successes++;row.inputTokens+=Math.max(0,Number(details.inputTokens)||0);row.outputTokens+=Math.max(0,Number(details.outputTokens)||0)}
 if(event==='error')row.errors++;
 row.updatedAt=Date.now();await tx.put(key,row)});
}
export async function quotaReport(storage,day,roster,availability){
 const used=await storage.get('global:'+day)||0;
 const players=await Promise.all(roster.map(async p=>{const limit=await playerLimit(storage,p.user_id),used=await storage.get('user:'+day+':'+p.user_id)||0;return {userId:p.user_id,name:p.game_id,limit,used,remaining:Math.max(0,limit-used),custom:await storage.get('limit:'+p.user_id)!==undefined}}));
 const providers=[];
 for(const provider of ['gemini','cloudflare']){
  const date=providerDay(provider),usage=await storage.get('usage:'+date+':'+provider)||null,state=availability.providers.find(x=>x.provider===provider);
  const limit=provider==='gemini'?await storage.get('config:geminiDailyLimit')??null:NEURON_BUDGET;
  const consumed=provider==='gemini'?usage?.attempts??0:await storage.get('neurons:'+date)||0;
  providers.push({provider,date,resetZone:provider==='gemini'?'America/Los_Angeles':'UTC',...state,usage,siteBudget:limit,siteConsumed:consumed,siteRemaining:limit===null?null:Math.max(0,limit-consumed),providerRemaining:null,providerRemainingReason:'未連接供應商帳戶用量查詢；本網站記錄不涵蓋同帳戶的其他程式。',measurement:provider==='gemini'?'本網站呼叫次數（含規劃與回答、失敗嘗試）':'本網站 Neurons 預算用量（成功請求按回傳 token 換算；無用量資料與失敗嘗試保守預留）',trackingSince:usage?.startedAt??null});
 }
 return {updatedAt:Date.now(),day,resetZone:'Asia/Taipei',defaultLimit:PLAYER_DEFAULT,global:{limit:GLOBAL_LIMIT,used,remaining:Math.max(0,GLOBAL_LIMIT-used)},players,providers};
}
