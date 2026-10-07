import test from 'node:test';import assert from 'node:assert/strict';
import {providerStart,geminiBalances,cloudflareBalance,ProviderQuotas} from './provider-quotas.js';
const now=Date.parse('2026-10-07T06:00:00Z'),labels={model:'gemini-3.5-flash-lite',limit_name:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'};
const point=(n,begin,end)=>({value:{int64Value:String(n)},interval:{startTime:begin,endTime:end}});
test('official provider days start at their own midnight including Pacific daylight saving',()=>{
 assert.equal(new Date(providerStart('gemini',now)).toISOString(),'2026-10-06T07:00:00.000Z');assert.equal(new Date(providerStart('cloudflare',now)).toISOString(),'2026-10-07T00:00:00.000Z');
 assert.equal(new Date(providerStart('gemini',Date.parse('2026-11-02T12:00:00Z'))).toISOString(),'2026-11-02T08:00:00.000Z');
});
test('Gemini uses complete project daily deltas without double counting minute quotas or summing duplicated limits',()=>{
 const limit={metric:{labels},points:[point(500,null,'2026-10-07T05:59:00Z')]};
 const usage={metric:{labels},points:[point(12,'2026-10-07T05:00:00Z','2026-10-07T05:01:00Z'),point(8,'2026-10-07T05:01:00Z','2026-10-07T05:02:00Z')]};
 const other={metric:{labels:{...labels,limit_name:'GenerateRequestsPerMinutePerProjectPerModel-FreeTier'}},points:[point(20,'2026-10-07T05:00:00Z','2026-10-07T05:01:00Z')]};
 const [r]=geminiBalances([limit,limit],[usage,other],now);assert.equal(r.limit,500);assert.equal(r.used,20);assert.equal(r.remaining,480);
 assert.equal(geminiBalances([limit],[],now)[0].remaining,null);
});
test('provider data cannot silently become a fabricated zero balance or a cross-day estimate',()=>{
 assert.throws(()=>geminiBalances([{metric:{labels},points:[point(500,null,'2026-10-07T05:59:00Z')]}],[{metric:{labels},points:[point(12,'2026-10-06T06:59:00Z','2026-10-06T07:01:00Z')]}],now),/reset_overlap/);
 assert.throws(()=>cloudflareBalance({errors:[{message:'secret raw diagnostic'}]}));assert.throws(()=>cloudflareBalance({data:{viewer:{accounts:[{}]}}}));
 const r=cloudflareBalance({data:{viewer:{accounts:[{aiInferenceAdaptiveGroups:[{sum:{totalNeurons:17.18}}]}]}}});assert.equal(r.remaining,9982.82);
});
test('missing read-only credentials makes no network requests and returns a truthful disconnected state',async()=>{
 const p=new ProviderQuotas({},()=>assert.fail('no credentials'));const r=await p.report();assert(r.providers.every(x=>x.remaining===null&&x.status==='not_connected'));
});
test('only fixed official endpoints receive scoped credentials and raw failures never reach the admin',async()=>{
 let calls=0;const p=new ProviderQuotas({CLOUDFLARE_QUOTA_TOKEN:'test-credential'},async(url,options)=>{calls++;assert.equal(url,'https://api.cloudflare.com/client/v4/graphql');const body=JSON.parse(options.body);assert.equal(body.variables.account,'d89184d96d606cf21e6593474488a452');assert(!body.query.includes('modelId'));return Response.json({errors:[{message:'test-credential secret provider response'}]})});
 const r=await p.report();assert.equal(calls,1);assert(!JSON.stringify(r).includes('test-credential'));assert.equal(r.providers[1].remaining,null);await p.report();assert.equal(calls,1);
});
