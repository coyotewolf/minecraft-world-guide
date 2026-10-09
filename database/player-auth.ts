import {boundedJson,RequestError,safeNewPassword} from './edge-security.mjs';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
const url=Deno.env.get('SUPABASE_URL')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const publicKey='sb_publishable_VbCO9ufRfxSZT8w7N7UtnA_zP5mkFgq';
const allowed=new Set(['https://coyotewolf.github.io','http://127.0.0.1:8765','http://localhost:8765']);
const enc=new TextEncoder();
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
function recovery(){return Array.from(crypto.getRandomValues(new Uint8Array(24))).map(x=>x.toString(16).padStart(2,'0')).join('').match(/.{1,8}/g)!.join('-')}
function check<T>(r:{data:T,error:any}):T {if(r.error)throw Error(r.error.message);return r.data}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':allowed.has(origin)?origin:'https://coyotewolf.github.io','Access-Control-Allow-Headers':'content-type,apikey,authorization,x-client-info,x-public-key','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method==='GET')return reply({ok:true,mode:'game-id-password',recovery:true});
 if(req.method!=='POST')return reply({error:'不支援此操作'},405);
 if(origin&&!allowed.has(origin))return reply({error:'不允許的網站來源'},403);
 // Registration is necessarily public. A scoped API key, explicit credential checks,
 // database-backed per-account/IP limits and a global ceiling guard the public gateway.
 if(req.headers.get('x-public-key')!==publicKey)return reply({error:'網站金鑰無效'},401);
 try {
  const body=await boundedJson(req);const name=String(body.gameId||'').trim().normalize('NFKC');const key=name.toLowerCase();
  if(!/^[a-z0-9_\-\u4e00-\u9fff]{3,32}$/u.test(key))return reply({error:'遊戲 ID 需為 3–32 個字，使用英文、數字、底線、連字號或中文字'},400);
  const password=String(body.password||'');if(password.length<10||password.length>72||enc.encode(password).length>72)return reply({error:'網站密碼需至少 10 個字元，最多 72 個 UTF-8 位元組（英文或數字最多 72 字元）'},400);
  const action=body.action;if(!['register','login','recover','admin-reset'].includes(action))return reply({error:'操作無效'},400);
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||req.headers.get('x-real-ip')||'unknown';
  const bucket=await hash(ip);const limit=action==='register'?10:action==='recover'?5:30;
  for(const k of [action+':ip:'+bucket,action+':id:'+key])if(!check(await admin.rpc('rate_limit',{k,lim:limit,seconds:3600})))return reply({error:'嘗試次數過多，請稍後再試'},429);
  if(action==='register'&&!check(await admin.rpc('rate_limit',{k:'register:global',lim:80,seconds:3600})))return reply({error:'目前註冊繁忙，請稍後再試'},429);
  if(action==='register'||action==='recover')await safeNewPassword(password);
  const email=(await hash(key))+'@players.invalid';
  let code:string|undefined;
  if(action==='admin-reset'){
   const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
   const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
   const verified=await caller.auth.getUser(token);if(verified.error)return reply({error:'請重新登入'},401);
   const status=check(await caller.rpc('player_status'));if(!status.admin)return reply({error:'需要管理員權限'},403);
   const found=check(await admin.rpc('account_lookup',{gkey:key}));if(!found[0])return reply({error:'找不到帳號'},404);
   const uid=found[0].user_id;code=recovery();
   check(await admin.rpc('revoke_player_sessions',{uid}));
   check(await admin.auth.admin.updateUserById(uid,{password:recovery()}));
   check(await admin.rpc('recovery_finish',{uid,rhash:await hash(code)}));
   return reply({recoveryCode:code});
  }
  if(action==='register'){
   const existing=check(await admin.rpc('account_lookup',{gkey:key}));if(existing.length)return reply({error:'這個 ID 已註冊，請登入或使用復原碼'},409);
   code=recovery();const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{game_id:name}});
   if(created.error||!created.data.user)return reply({error:'無法建立帳號，這個 ID 可能已被使用'},409);
   const uid=created.data.user.id;
   try{
    check(await admin.from('profiles').insert({id:uid,game_id:name}));
    check(await admin.rpc('account_store',{uid,gkey:key,rhash:await hash(code)}));
    check(await admin.from('worlds').insert({user_id:uid,name:'鋼鐵與秘法：帝國紀元'}));
    if(body.setupCode)check(await admin.rpc('bootstrap_admin',{uid,h:await hash(String(body.setupCode).trim())}));
   }catch(e){await admin.auth.admin.deleteUser(uid);throw e}
  }
  if(action==='recover'){
   const supplied=String(body.recoveryCode||'').trim().toLowerCase();const found=check(await admin.rpc('account_lookup',{gkey:key}));
   const a=found[0];const rhash=await hash(supplied);
   if(!a||a.recovery_hash!==rhash)return reply({error:'ID 或復原碼不正確'},401);
   if(!check(await admin.rpc('recovery_lock',{uid:a.user_id,rhash})))return reply({error:'帳號正在復原，請稍後再試'},409);
   // Revoke live sessions first. RLS checks auth.sessions, so old access tokens also stop working.
   check(await admin.rpc('revoke_player_sessions',{uid:a.user_id}));
   check(await admin.auth.admin.updateUserById(a.user_id,{password}));
   code=recovery();check(await admin.rpc('recovery_finish',{uid:a.user_id,rhash:await hash(code)}));
  }
  const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.signInWithPassword({email,password});
  if(login.error||!login.data.session)return reply({error:'ID 或網站密碼不正確'},401);
  const approved=check(await admin.rpc('account_status',{gkey:key}));
  return reply({session:login.data.session,recoveryCode:code,approved:!!approved});
 }catch(e){if(e instanceof RequestError)return reply({error:e.message},e.status);console.error('player-auth request failed');return reply({error:'暫時無法完成，請稍後再試'},500)}
});
