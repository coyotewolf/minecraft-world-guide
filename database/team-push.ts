import {boundedJson,RequestError,sameSecret} from './edge-security.mjs';
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import webpush from 'npm:web-push@3.6.7';
const origin='https://coyotewolf.github.io',subject='https://coyotewolf.github.io/minecraft-world-guide/';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function safeEndpoint(endpoint:string){try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)||u.hostname.endsWith('.notify.windows.com'));}catch{return false}}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  let config:any;
  const hook=req.headers.get('x-push-hook');
  if(hook){
   if(hook.length>256)return reply({error:'Forbidden'},403);
   const result=await admin.rpc('push_configuration');if(result.error)throw result.error;config=result.data;
   if(!config||!sameSecret(hook,config.hookSecret))return reply({error:'Forbidden'},403);
   const body=await boundedJson(req);
   if(typeof body?.requestId!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.requestId))return reply({error:'Invalid request'},400);
   const {data:r,error:re}=await admin.from('requests').select('id,team_id,title,kind,status').eq('id',body.requestId).single();
   if(re||!r||r.status==='cancelled')return reply({delivered:0});
   const {data:devices,error:de}=await admin.rpc('push_recipients',{rid:r.id});if(de)throw de;
   const payload=JSON.stringify({title:r.kind==='item'?'隊伍有新的物品需求':'隊伍有新的邀約',body:'點擊查看隊伍留言板',tag:'request-'+r.id,url:subject+'#team?request='+r.id+'&team='+r.team_id});
   let delivered=0;
   await Promise.all((devices||[]).map(async(d:any)=>{if(!safeEndpoint(d.subscription.endpoint))return;try{await webpush.sendNotification(d.subscription,payload,{vapidDetails:{subject,publicKey:config.publicKey,privateKey:config.privateKey},TTL:3600,timeout:8000});delivered++;}catch(e){if([404,410].includes(e.statusCode))await admin.rpc('drop_push_device',{did:d.device_id});}}));
   return reply({delivered});
  }
  if(req.headers.get('origin')!==origin)return reply({error:'Forbidden'},403);
  const authorization=req.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer ')||authorization.length>8192)return reply({error:'請先登入'},401);
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:{user},error:ae}=await client.auth.getUser();if(ae||!user)return reply({error:'請先登入'},401);
  // Profile RLS verifies the current approved session, including revoked sessions.
  const {data:p}=await client.from('profiles').select('id').eq('id',user.id).single();if(!p)return reply({error:'需要核准的玩家帳號'},403);
  await boundedJson(req);
  const current=await admin.rpc('push_configuration');if(current.error)throw current.error;config=current.data;
  if(!config){const keys=webpush.generateVAPIDKeys();const result=await admin.rpc('push_configuration',{value:{...keys,hookSecret:crypto.randomUUID()+crypto.randomUUID()}});if(result.error)throw result.error;config=result.data;}
  return reply({publicKey:config.publicKey});
 }catch(e){if(e instanceof RequestError)return reply({error:e.message},e.status);return reply({error:'通知服務暫時無法使用'},500)}
});
