import test from 'node:test';
import assert from 'node:assert/strict';
import {announcementFeed} from './announcements.js';
const env={SITE_ORIGIN:'https://coyotewolf.github.io',SUPABASE_URL:'https://project.supabase.co',SUPABASE_KEY:'public-key'};
const request=(headers={},method='GET')=>new Request('https://worker.test/announcements',{method,headers});
const rows=[{id:'00000000-0000-4000-8000-000000000001',title:'維護',body:'今晚維護',created_at:'2026-10-11T00:00:00Z',expires_at:'2026-10-12T00:00:00Z'}];
test('public feed has no auth/model calls, shared cache and conditional 304',async()=>{
 let stored,calls=0;const cache={match:async()=>stored?.clone(),put:async(k,r)=>{stored=r}};
 const fetcher=async(url,options)=>{calls++;assert.equal(url.searchParams.get('limit'),'20');assert.equal(options.headers.Authorization,undefined);return Response.json(rows)};
 const r=await announcementFeed(request(),env,{fetcher,cache});assert.equal(r.status,200);assert.deepEqual((await r.json()).announcements,rows);assert.match(r.headers.get('Cache-Control'),/max-age=60/);
 const etag=r.headers.get('ETag');const unchanged=await announcementFeed(request({'If-None-Match':etag}),env,{fetcher,cache});assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');assert.equal(calls,1);
 const browser=await announcementFeed(request({Origin:env.SITE_ORIGIN}),env,{fetcher,cache});assert.equal(browser.headers.get('Access-Control-Allow-Origin'),env.SITE_ORIGIN);assert.equal(calls,1);
});
test('reject other origins/methods and respect kill switch before cache',async()=>{
 const never=()=>{throw Error('should not fetch')};
 assert.equal((await announcementFeed(request({Origin:'https://evil.test'}),env,{fetcher:never})).status,403);
 assert.equal((await announcementFeed(request({},'POST'),env,{fetcher:never})).status,405);
 assert.equal((await announcementFeed(request(),{...env,NATIVE_CLIENT_ENABLED:'false'},{fetcher:never})).status,503);
 const preflight=await announcementFeed(request({Origin:env.SITE_ORIGIN},'OPTIONS'),env,{fetcher:never});assert.equal(preflight.status,204);assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/If-None-Match/);
});
test('fail closed on upstream errors or invalid/oversized feed, never cache errors',async()=>{
 for(const fetcher of [async()=>new Response('{}',{status:500}),async()=>Response.json({}),async()=>Response.json(Array(21).fill(rows[0])),async()=>Response.json([{...rows[0],body:'x'.repeat(501)}])]){
 let puts=0;const r=await announcementFeed(request(),env,{fetcher,cache:{match:async()=>null,put:async()=>puts++}});assert.equal(r.status,503);assert.equal(puts,0);assert.equal(r.headers.get('Cache-Control'),'no-store');
 }
});
