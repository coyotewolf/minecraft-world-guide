// Origin is browser policy, never identity. Native entry points still authenticate
// through approvedUser in worker.js before touching models, caches or quota.
export function clientAccess(request, env) {
 const origin=request.headers.get('Origin');
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
 if(origin!==null){
  if(origin!==env.SITE_ORIGIN)return {headers,status:403,error:'不允許此網站使用。'};
  Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'});
  return {headers};
 }
 if(env.NATIVE_CLIENT_ENABLED==='false')return {headers,status:403,error:'遊戲內助手暫停連線，請使用攻略網站。'};
 const path=new URL(request.url).pathname;
 if(!((path==='/ask'||path==='/forget')&&request.method==='POST'||path==='/status'&&request.method==='GET'))return {headers,status:403,error:'不允許此客戶端功能。'};
 const auth=request.headers.get('Authorization');
 if(!auth?.startsWith('Bearer ')||auth.length<=7||auth.length>8192)return {headers,status:401,error:'請登入已通過審核的玩家帳號。'};
 return {headers};
}
