import {providerDay} from './quota-admin.js';
const PROJECT='gen-lang-client-0388317824',ACCOUNT='d89184d96d606cf21e6593474488a452';
const REQUEST_METRIC='generativelanguage.googleapis.com/quota/generate_content_free_tier_requests';
export function providerStart(provider,now=Date.now()){
 const day=providerDay(provider,now);let low=now-30*3600000,high=now;
 while(high-low>1){const mid=Math.floor((low+high)/2);if(providerDay(provider,mid)===day)high=mid;else low=mid}return high;
}
const number=x=>{if(typeof x!=='number'&&typeof x!=='string')throw Error('invalid_data');const n=Number(x);if(!Number.isFinite(n)||n<0)throw Error('invalid_data');return n};
const value=point=>number(point?.value?.int64Value??point?.value?.doubleValue);
export function geminiBalances(limits,usage,now=Date.now()){
 const rows=new Map(),start=providerStart('gemini',now);
 for(const series of limits){const labels=series.metric?.labels||{};if(labels.limit_name!=='GenerateRequestsPerDayPerProjectPerModel-FreeTier'||!labels.model)continue;
  const point=series.points?.find(p=>Date.parse(p.interval?.endTime)>=now-86400000);if(!point)continue;
  const limit=value(point),prior=rows.get(labels.model);rows.set(labels.model,{model:labels.model,limit:prior?Math.min(limit,prior.limit):limit,used:null,observedThrough:null});
 }
 for(const series of usage){const labels=series.metric?.labels||{};if(labels.limit_name!=='GenerateRequestsPerDayPerProjectPerModel-FreeTier')continue;const row=rows.get(labels.model);if(!row)continue;
  for(const p of series.points||[]){const end=Date.parse(p.interval?.endTime),begin=Date.parse(p.interval?.startTime);if(!Number.isFinite(begin)||!Number.isFinite(end))throw Error('invalid_data');if(end<=start||end>now)continue;
   // A delta crossing the reset boundary cannot be apportioned accurately.
   if(begin<start)throw Error('reset_overlap');row.used=(row.used??0)+value(p);row.observedThrough=Math.max(row.observedThrough||0,end);
  }
 }
 return [...rows.values()].map(r=>({...r,remaining:r.used===null?null:Math.max(0,r.limit-r.used)}));
}
export function cloudflareBalance(body){
 if(body.errors?.length){const message=String(body.errors[0]?.message||'');const error=Error(/unknown|cannot query|undefined|not defined|invalid.*(?:argument|query)|type.*expected/i.test(message)?'query_schema':/permission|access|auth|token/i.test(message)?'permission':'provider_query');error.identifier=message.match(/(?:field|type|argument) [\"']?([A-Za-z_][A-Za-z0-9_]{0,63})/i)?.[1]||null;error.stage='cloudflare-analytics';throw error}const accounts=body.data?.viewer?.accounts;
 if(!Array.isArray(accounts)||accounts.length!==1)throw Error('invalid_data');const groups=accounts[0].aiInferenceAdaptiveGroups;
 if(!Array.isArray(groups))throw Error('invalid_data');let used=0;
 for(const g of groups)used+=number(g.sum?.totalNeurons);
 return {limit:10000,used,remaining:Math.max(0,10000-used)};
}
async function json(fetcher,url,options={}){
 const response=await fetcher(url,{...options,signal:AbortSignal.timeout(12000)});
 if(!response.ok){const body=await response.json().catch(()=>({})),reason=(body.error?.details||[]).find(x=>x.reason)?.reason;const message=String(body.errors?.[0]?.message||body.error?.message||'');const code=/requires billing.*enabled/i.test(message)?'billing_required':reason==='SERVICE_DISABLED'?'api_disabled':/not supported|unsupported.*token/i.test(message)?'auth_type':/unknown|cannot query|undefined|not defined|invalid.*(?:argument|query)|type.*expected/i.test(message)?'query_schema':/authenticat|permission|authoriz|access denied|invalid.*token/i.test(message)||response.status===401||response.status===403?'permission':response.status===429?'rate_limit':response.status===400?'bad_request':'provider_unavailable';const error=Error(code);error.identifier=message.match(/(?:field|type|argument) [\"']?([A-Za-z_][A-Za-z0-9_]{0,63})/i)?.[1]||null;error.providerCode=Number.isInteger(body.errors?.[0]?.code)?body.errors[0].code:null;error.stage=String(url).includes('oauth2')?'google-auth':String(url).includes('monitoring')?'google-metrics':'cloudflare-analytics';error.httpStatus=response.status;throw error;}
 return response.json();
}
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export class ProviderQuotas{
 constructor(env,fetcher=fetch){this.env=env;this.fetcher=fetcher;this.cache=null;this.pending=null;this.token=null}
 async googleToken(){
  if(this.token?.expires>Date.now()+60000)return this.token.value;
  const credentials=JSON.parse(this.env.GOOGLE_QUOTA_SERVICE_ACCOUNT||'null');
  if(credentials?.type!=='service_account'||credentials.project_id!==PROJECT||!credentials.client_email?.endsWith('.iam.gserviceaccount.com')||!credentials.private_key)throw Error('configuration');
  const now=Math.floor(Date.now()/1000),encode=x=>b64(new TextEncoder().encode(JSON.stringify(x)));
  const message=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/monitoring.read',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const pem=credentials.private_key.replace(/-----[^-]+-----|\s/g,''),key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(message))));
  const response=await json(this.fetcher,'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:message+'.'+signature})});
  if(typeof response.access_token!=='string'||!response.access_token)throw Error('permission');this.token={value:response.access_token,expires:Date.now()+Math.min(number(response.expires_in),3600)*1000};return this.token.value;
 }
 async series(suffix,token,now){
  const url=new URL('https://monitoring.googleapis.com/v3/projects/'+PROJECT+'/timeSeries');
  url.search=new URLSearchParams({filter:'metric.type="'+REQUEST_METRIC+'/'+suffix+'" AND metric.labels.limit_name="GenerateRequestsPerDayPerProjectPerModel-FreeTier"', 'interval.startTime':new Date(suffix==='usage'?providerStart('gemini',now):now-86400000).toISOString(),'interval.endTime':new Date(now).toISOString(),view:'FULL',pageSize:'100000'});
  const rows=[];for(let page=0;page<10;page++){const data=await json(this.fetcher,url,{headers:{Authorization:'Bearer '+token}});if(data.timeSeries!==undefined&&!Array.isArray(data.timeSeries))throw Error('invalid_data');rows.push(...data.timeSeries||[]);if(!data.nextPageToken)return rows;url.searchParams.set('pageToken',data.nextPageToken)}throw Error('incomplete_data');
 }
 async gemini(now){
  const token=await this.googleToken(),[limit,usage]=await Promise.all([this.series('limit',token,now),this.series('usage',token,now)]),models=geminiBalances(limit,usage,now);
  if(!models.length)throw Error('no_data');const current=models.find(m=>m.model==='gemini-3.5-flash-lite');
  return {provider:'gemini',scope:'Google 專案 '+PROJECT+' 的所有 API 金鑰；免費模型分別計額度',source:'Google Cloud Monitoring',status:current?.remaining!==null&&current?.remaining!==undefined?'available':'no_data',models,remaining:current?.remaining??null,used:current?.used??null,limit:current?.limit??null,observedThrough:current?.observedThrough??null,reason:'官方監控資料可能延遲數分鐘；未收到資料不當成用量為零。'};
 }
 async cloudflare(now){
  if(!/^[A-Za-z0-9_-]{20,200}$/.test(String(this.env.CLOUDFLARE_QUOTA_TOKEN||'').trim()))throw Error('credential_format');
  const query='query($account: String!, $start: Time!, $end: Time!){viewer{accounts(filter:{accountTag:$account}){aiInferenceAdaptiveGroups(limit:1,filter:{datetime_geq:$start,datetime_lt:$end}){sum{totalNeurons}}}}}';
  const body=await json(this.fetcher,'https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:'Bearer '+this.env.CLOUDFLARE_QUOTA_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{account:ACCOUNT,start:new Date(providerStart('cloudflare',now)).toISOString(),end:new Date(now).toISOString()}})});
  return {provider:'cloudflare',...cloudflareBalance(body),status:'available',scope:'Cloudflare 完整帳戶的所有 Workers、Pages 與 REST 推論',source:'Cloudflare 官方帳戶 Analytics',observedThrough:null,queryEnd:now,reason:'官方 Analytics 含採樣與更新延遲；此值不是保證即時可用的額度。'};
 }
 async report(){
  const now=Date.now();if(this.cache?.expires>now&&this.cache.geminiDay===providerDay('gemini',now)&&this.cache.cfDay===providerDay('cloudflare',now))return this.cache.value;
  if(this.pending)return this.pending;
  this.pending=(async()=>{const rows=await Promise.all(['gemini','cloudflare'].map(async provider=>{
   const configured=!!this.env[provider==='gemini'?'GOOGLE_QUOTA_SERVICE_ACCOUNT':'CLOUDFLARE_QUOTA_TOKEN'];if(!configured)return {provider,status:'not_connected',remaining:null,reason:'尚未設定官方用量的只讀連線。'};
   try{return {...await this[provider](now),fetchedAt:now,date:providerDay(provider,now)}}catch(e){const code=['permission','configuration','rate_limit','no_data','incomplete_data','reset_overlap','api_disabled','bad_request','query_schema','provider_query','auth_type','credential_format','billing_required'].includes(e.message)?e.message:'provider_unavailable';return {provider,status:code,remaining:null,diagnostic:{stage:e.stage||provider,httpStatus:e.httpStatus||null,identifier:e.identifier||null,providerCode:e.providerCode||null},reason:code==='billing_required'?'Google 官方用量 API 要求專案啟用計費；依完全免費規則未綁定帳单，無法取得自動餘額。': '官方用量讀取失敗（'+code+(e.stage?' / '+e.stage:'')+(e.identifier?' / '+e.identifier:'')+(e.providerCode?' / '+e.providerCode:'')+'）；不使用本站計數或舊日數字代替。',fetchedAt:now,date:providerDay(provider,now)}}
  }));const value={providers:rows};this.cache={value,expires:now+60000,geminiDay:providerDay('gemini',now),cfDay:providerDay('cloudflare',now)};return value})().finally(()=>{this.pending=null});return this.pending;
 }
}
