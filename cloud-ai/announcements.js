// Public notices only. This endpoint never reads player identities or calls AI.
export async function announcementFeed(request,env,{fetcher=fetch,cache=globalThis.caches?.default,now=Date.now()}={}){
 const origin=request.headers.get('Origin'),headers={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(origin&&origin!==env.SITE_ORIGIN)return new Response('{}',{status:403,headers});
 if(origin)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'If-None-Match'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='GET')return new Response('{}',{status:405,headers:{...headers,Allow:'GET'}});
 if(env.NATIVE_CLIENT_ENABLED==='false')return new Response('{}',{status:503,headers:{...headers,'Cache-Control':'no-store'}});
 const key=new Request(new URL('/announcements',request.url),{method:'GET'});
 let response=await cache?.match(key);
 if(!response){
  try{
   const url=new URL(env.SUPABASE_URL+'/rest/v1/game_announcements');
   url.search=new URLSearchParams({select:'id,title,body,created_at,expires_at',withdrawn:'eq.false',expires_at:'gt.'+new Date(now).toISOString(),order:'created_at.asc,id.asc',limit:'20'});
   const r=await fetcher(url,{headers:{apikey:env.SUPABASE_KEY},signal:AbortSignal.timeout(8000)});
   if(!r.ok)throw Error('feed_unavailable');
   const rows=await r.json();if(!Array.isArray(rows)||rows.length>20)throw Error('invalid_feed');
   for(const row of rows)if(!/^[0-9a-f-]{36}$/i.test(row.id)||typeof row.title!=='string'||[...row.title].length>80||typeof row.body!=='string'||[...row.body].length>500||!Number.isFinite(Date.parse(row.expires_at)))throw Error('invalid_notice');
   const body=JSON.stringify({version:1,announcements:rows});
   if(new TextEncoder().encode(body).length>65536)throw Error('feed_too_large');
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
   const etag='"'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')+'"';
   response=new Response(body,{headers:{'Content-Type':headers['Content-Type'],'Cache-Control':'public, max-age=60',ETag:etag}});
   await cache?.put(key,response.clone());
  }catch{return new Response(JSON.stringify({error:'公告暫時無法讀取。'}),{status:503,headers:{...headers,'Cache-Control':'no-store'}})}
 }
 const etag=response.headers.get('ETag');headers.ETag=etag;headers['Cache-Control']='public, max-age=60';
 if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers});
 return new Response(response.body,{headers});
}
