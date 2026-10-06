import {quotaChange,changeQuota,quotaReport} from './quota-admin.js';
import {DurableObject} from 'cloudflare:workers';
import {GuideService,approvedUser,approvedIdentity,questionBody,dayKey} from './core.js';
async function boundedBody(request){if(!request.body)return '';const reader=request.body.getReader(),chunks=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Error('body_too_large')}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return new TextDecoder().decode(bytes)}
export class GuideCoordinator extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.service=new GuideService(ctx.storage,env);this.queue=Promise.resolve()}
 availability(){return this.service.availability()}
 async adminReport(roster){return quotaReport(this.ctx.storage,dayKey(),roster,await this.service.availability())}
 adminChange(change,adminId){const next=this.queue.then(()=>changeQuota(this.ctx.storage,change,adminId));this.queue=next.catch(()=>{});return next}
 ask(uid,question,conversationId,cloudTurns=[],requestId){const next=this.queue.then(async()=>{if(!await this.ctx.storage.getAlarm())await this.ctx.storage.setAlarm(Date.now()+86400000);try{const key=requestId?'request:'+uid+':'+(conversationId||'new')+':'+requestId:null;const cached=key?await this.ctx.storage.get(key):null;if(cached?.expires>Date.now())return cached.question===question?cached.result:{status:409,body:{error:'訊息內容已更改，請重新傳送。'}};const result=await this.service.ask(uid,question,conversationId,cloudTurns);if(key&&result.status===200)await this.ctx.storage.put(key,{question,result,expires:Date.now()+86400000});return result}catch(error){const m=String(error?.message||'');const diagnostic=/subrequest/i.test(m)?'request_budget':/memory/i.test(m)?'memory':/knowledge_unavailable/.test(m)?'knowledge':/json/i.test(m)?'knowledge_format':'processing';return {status:503,body:{error:'小助手暫時連線不穩，請稍後重試。',code:'server_error',diagnostic,stage:this.service.stage||'unknown'}}}});this.queue=next.catch(()=>{});return next}
 async alarm(){await this.service.cleanup();await this.ctx.storage.setAlarm(Date.now()+86400000)}
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin');const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
 if(origin!==env.SITE_ORIGIN)return new Response(JSON.stringify({error:'不允許此網站使用。'}),{status:403,headers});
 headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';
 const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(new URL(request.url).pathname==='/health'&&request.method==='GET')return send({ready:env.FREE_ONLY_ACK==='true',primary:!!(env.GEMINI_API_KEY||env.gemini_api),fallback:!!env.AI});
 if(new URL(request.url).pathname==='/status'&&request.method==='GET'){const uid=await approvedUser(request,env);if(!uid)return send({error:'請登入玩家帳號。'},401);return send(await env.GUIDE.getByName('aoi-free-guide').availability())}
 if(new URL(request.url).pathname==='/admin/quotas'&&['GET','POST'].includes(request.method)){
  try{
   const identity=await approvedIdentity(request,env);if(!identity?.admin)return send({error:'需要網站管理員權限。'},403);
   const r=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/admin_players',{method:'POST',headers:{Authorization:request.headers.get('Authorization'),apikey:env.SUPABASE_KEY,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
   if(!r.ok)return send({error:'無法確認玩家名單。'},503);const roster=await r.json();if(!Array.isArray(roster)||roster.length>2000)return send({error:'玩家名單無法讀取。'},503);
   const coordinator=env.GUIDE.getByName('aoi-free-guide');
   if(request.method==='POST'){
    let change;try{change=quotaChange(JSON.parse(await boundedBody(request)))}catch(e){return send({error:e.message==='body_too_large'?'設定過長。':e.message},400)}
    if(change.userId&&!roster.some(p=>p.user_id===change.userId))return send({error:'找不到這個玩家。'},404);
    await coordinator.adminChange(change,identity.id);
   }
   return send(await coordinator.adminReport(roster));
  }catch{return send({error:'無法讀取問答用量，請稍後重試。'},503)}
 }
 if(new URL(request.url).pathname!=='/ask'||request.method!=='POST')return send({error:'找不到這個功能。'},404);
 try{if(Number(request.headers.get('Content-Length')||0)>4096)return send({error:'問題過長。'},413);let text;try{text=await boundedBody(request)}catch{return send({error:'問題過長。'},413)}let body;try{body=questionBody(JSON.parse(text))}catch{return send({error:'請輸入 1～600 字的問題。'},400)}
 const uid=await approvedUser(request,env);if(!uid)return send({error:'請登入已通過審核的玩家帳號。'},401);
 let cloudTurns=[];
 if(body.conversationId){try{const url=new URL(env.SUPABASE_URL+'/rest/v1/assistant_messages');url.search=new URLSearchParams({select:'role,text',user_id:'eq.'+uid,conversation_id:'eq.'+body.conversationId,order:'created_at.desc,id.desc',limit:'24'});const r=await fetch(url,{headers:{Authorization:request.headers.get('Authorization'),apikey:env.SUPABASE_KEY},signal:AbortSignal.timeout(5000)});if(r.ok){const messages=(await r.json()).reverse();if(messages.at(-1)?.role==='user'&&messages.at(-1).text===body.question)messages.pop();for(const m of messages){if(m.role==='user')cloudTurns.push({user:String(m.text).slice(0,600),assistant:''});else if(cloudTurns.length&&!/免費.*(?:用完|無法)|暫時.*(?:忙碌|連線|回覆|無法)|等候較久/.test(m.text))cloudTurns.at(-1).assistant=String(m.text).slice(0,1600)}cloudTurns=cloudTurns.filter(t=>t.assistant).slice(-10)}}catch{}}
 const result=await env.GUIDE.getByName('aoi-free-guide').ask(uid,body.question,body.conversationId,cloudTurns,body.requestId);return send(result.body,result.status);
 }catch{return send({error:'問答暫時無法連線，解包搜尋仍可使用。'},503)}
}};
