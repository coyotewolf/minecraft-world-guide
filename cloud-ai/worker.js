import {DurableObject} from 'cloudflare:workers';
import {GuideService,approvedUser,questionBody} from './core.js';
async function boundedBody(request){if(!request.body)return '';const reader=request.body.getReader(),chunks=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Error('body_too_large')}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return new TextDecoder().decode(bytes)}
export class GuideCoordinator extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.service=new GuideService(ctx.storage,env);this.queue=Promise.resolve()}
 ask(uid,question,conversationId){const next=this.queue.then(async()=>{if(!await this.ctx.storage.getAlarm())await this.ctx.storage.setAlarm(Date.now()+86400000);return this.service.ask(uid,question,conversationId)});this.queue=next.catch(()=>{});return next}
 async alarm(){await this.service.cleanup();await this.ctx.storage.setAlarm(Date.now()+86400000)}
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin');const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
 if(origin!==env.SITE_ORIGIN)return new Response(JSON.stringify({error:'不允許此網站使用。'}),{status:403,headers});
 headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';
 const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(new URL(request.url).pathname==='/health'&&request.method==='GET')return send({ready:env.FREE_ONLY_ACK==='true',primary:!!(env.GEMINI_API_KEY||env.gemini_api),fallback:!!env.AI});
 if(new URL(request.url).pathname!=='/ask'||request.method!=='POST')return send({error:'找不到這個功能。'},404);
 try{if(Number(request.headers.get('Content-Length')||0)>4096)return send({error:'問題過長。'},413);let text;try{text=await boundedBody(request)}catch{return send({error:'問題過長。'},413)}let body;try{body=questionBody(JSON.parse(text))}catch{return send({error:'請輸入 1～600 字的問題。'},400)}
 const uid=await approvedUser(request,env);if(!uid)return send({error:'請登入已通過審核的玩家帳號。'},401);
 const result=await env.GUIDE.getByName('aoi-free-guide').ask(uid,body.question,body.conversationId);return send(result.body,result.status);
 }catch{return send({error:'問答暫時無法連線，解包搜尋仍可使用。'},503)}
}};
