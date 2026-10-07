import {routineExcerpt} from './evidence-integrity.js';
const stop=new Set(['請問','在哪','哪裡','怎麼','如何','可以','我想','取得','掉落','製作','合成','配方','材料','機率','什麼','多少','它的','那它','得到','需要','要怎','麼取']);
export function tokens(q){const text=String(q).toLowerCase(),out=text.match(/[a-z0-9_:.-]+/g)||[];out.push(...out.flatMap(t=>t.split(/[.:]/).filter(part=>part.length>=3&&/[a-z]/.test(part))));for(const run of text.match(/[\u3400-\u9fff]+/g)||[]){if(run.length>2)out.push(run);for(let i=0;i<run.length-1;i++)out.push(run.slice(i,i+2))}return [...new Set(out)].filter(t=>t.length>1&&!stop.has(t))}
export const recommendation=q=>/無聊|幹嘛|做什麼|玩什麼|推薦|下一個目標|不知道.*(做|玩)|有什麼.*(玩|做)|新手|入門|開始玩|嗨|你好/.test(q);
const expanded=q=>/地形|拆家|毀.*建築|破壞.*(方塊|房子|基地)/.test(q)?q+' 地形與建築破壞':q;
const intent=q=>/取得|掉落|哪裡|在哪|機率/.test(q)?'取得與掉落':/製作|合成|配方|材料/.test(q)?'製作配方':'';
export function rank(rows,q,limit=18,anchors=[]){const terms=tokens(q);if(!terms.length&&!anchors.length)return [];const hay=f=>(f.search||f.title||'').toLowerCase(),df=new Map(terms.map(t=>[t,rows.filter(f=>hay(f).includes(t)).length]));return rows.map(f=>{const text=hay(f),names=(f.title+' '+(f.labels||[]).join(' ')).toLowerCase();let score=terms.reduce((n,t)=>n+(text.includes(t)?Math.log(1+rows.length/(1+df.get(t)))*(t.length>2?2:1):0),0);const exact=anchors.some(a=>names.includes(a));if(anchors.length&&!exact)return {f,score:0};if(exact)score+=12;if(anchors.length&&intent(q)==='製作配方'&&f.playerTitle&&f.title.startsWith('製作配方')&&!anchors.some(a=>f.playerTitle.toLowerCase().includes(a)))return {f,score:0};if(score&&intent(q)&&f.title.startsWith(intent(q)))score+=4;return {f,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.f.id.localeCompare(b.f.id)).slice(0,limit).map(x=>x.f)}
export async function activityPool(manifest,q,read,options={}){
 if(!manifest.activities)return [];
 manifest._activities??=await read(manifest.activities);
 const rows=manifest._activities.map((a,i)=>({id:'activity-'+a.article+'-'+i,title:a.title,playerTitle:a.title,playerSummary:a.firstStep,text:a.firstStep,source:'目前模組包已核對的教學',article:a.article,shard:manifest.activities,labels:[a.group],search:a.group+' '+a.title+' '+a.firstStep})).filter(f=>!options.advanced||!['start','controls','backpack','food','factory','key-search','hud','map','rescue'].includes(f.article));
 const matched=rank(rows.map(f=>({...f,search:f.labels[0]+' '+f.title})),q,8);
 // Individual activities keep their concrete first step. Fill broad questions
 // with a diverse pool instead of concatenating menus of unrelated activities.
 const playable=options.advanced?['space','storage-crafting','artillery','companions','ships','factory-brass','spawners','organs']:['food','backpack','factory','decor','companions','trains','ships','magic'];
 const groups=new Set(),picks=[];
 for(const row of [...playable.slice(0,2).flatMap(article=>rows.filter(f=>f.article===article)),...matched,...playable.slice(2).flatMap(article=>rows.filter(f=>f.article===article)),...rows])if(!groups.has(row.labels[0])){groups.add(row.labels[0]);picks.push(row)}
 for(const row of [...matched,...playable.flatMap(article=>rows.filter(f=>f.article===article))])if(!picks.some(f=>f.id===row.id))picks.push(row);
 return picks.slice(0,12);
}
export async function retrieve(manifest,q,read){const query=expanded(q),terms=tokens(query),wanted=intent(q);let anchors=[],files=[],reviewed=[];if(manifest.reviewed){manifest._reviewed??=await read(manifest.reviewed);reviewed=manifest._reviewed.filter(f=>f.matchAll?.every(group=>group.some(t=>q.includes(t)))||f.topics?.some(t=>q.includes(t)))}const picks=recommendation(q)?await activityPool(manifest,q,read):[];if(manifest.entityIndex){manifest._entities??=await read(manifest.entityIndex);const normalized=q.toLowerCase();const matched=Object.keys(manifest._entities).filter(n=>normalized.includes(n));anchors=matched.filter(n=>!matched.some(other=>other.length>n.length&&other.includes(n)));files=[...new Set(anchors.flatMap(n=>manifest._entities[n]))]}const ranked=manifest.shards.map(s=>{let n=terms.reduce((n,t)=>n+(s.terms.toLowerCase().includes(t)?(t.length>2?3:1):0),0);if(n&&wanted&&s.kinds?.includes(wanted))n+=2;if(files.includes(s.file))n+=100;return {s,n}}).filter(x=>x.n>0&&(!files.length||files.includes(x.s.file))).sort((a,b)=>b.n-a.n);const found=[];for(const {s} of ranked.slice(0,8))found.push(...rank(await read(s.file),query,24,anchors));return [...reviewed,...rank(found,query),...picks].filter((f,i,all)=>all.findIndex(v=>v.id===f.id)===i).slice(0,18)}

// Bilingual action vocabulary locates code and JSON fields; it adds search
// terms only, never assumed mechanics or game facts.
const actionQuery=q=>q+' '+[
 [/馴服|餵|吃什麼/, 'tame taming isFood food interact'],
 [/騎|坐騎/, 'ride mount passenger interaction'],
 [/飛行|會飛/, 'fly flying flight'],
 [/孵|繁殖|成長/, 'hatch egg breed grow'],
 [/破壞|拆|建築安全/, 'grief destroy break block'],
 [/配方|製作|合成/, 'recipe ingredients result craft crafting construct'],
 [/自動|輸送|收納/, 'inventory insert extract automation transfer logistics'],
 [/攻擊|傷害|技能|法術|射擊|開砲/, 'attack damage hurt ability effect fire shoot projectile'],
 [/烹|料理|加熱/, 'cook cooking heat temperature fuel'],
 [/啟動|使用|操作|互動|開啟/, 'use activate interact handle'],
 [/種植|收成|生長/, 'plant harvest grow']
].filter(([pattern])=>pattern.test(q)).map(([,words])=>words).join(' ');
function focusRuntime(f,q){
 if(!f.runtimeEvidence)return f;
 const words=tokens(actionQuery(q)).filter(t=>/^[a-z]{4,}$/.test(t)),lines=String(f.text||'').split('\n');let best=-1,score=0;
 for(let i=0;i<lines.length;i++){const m=lines[i].match(/\b(?:public|private|protected)\s+(?:static\s+)?[\w<>]+\s+(\w+)\s*\(/);if(!m)continue;const hits=words.filter(w=>m[1].toLowerCase().includes(w)).length,n=hits*(/^(?:handle|try|perform|apply|process)/i.test(m[1])?300:100);if(n>score){score=n;best=i}}
 if(best<0)return f;const excerpt=routineExcerpt(lines.slice(best).join('\n'));return {...f,actionScore:score,retrievalText:excerpt.text,retrievalComplete:excerpt.complete,retrievalScope:excerpt.reason};
}
// Bounded multi-query retrieval balances evidence kinds before reading shards.
// Secondary queries broaden wording, never add game facts to the prompt.
export async function retrieveMany(manifest,queries,read,options={}){
 const normalized=[...new Set(queries.filter(q=>typeof q==='string'&&q.trim()).map(q=>q.trim().slice(0,180)))].slice(0,4),cache=new Map();
 const once=file=>{if(!cache.has(file))cache.set(file,read(file));return cache.get(file)};
 if(!manifest._coverage)manifest._coverage=await once('coverage-index.json').catch(()=>({subjects:{}}));
 const locator=manifest._coverage.subjects||{};
 let codeLookup={};if(options.related){const words=normalized.flatMap(tokens).filter(t=>/^[a-z][a-z0-9_]{4,}$/.test(t)).sort((a,b)=>b.length-a.length);const prefixes=[...new Set(words.map(t=>t[0]))].slice(0,4);for(const prefix of prefixes){const file=manifest._coverage.codeLookup?.[prefix];if(file)Object.assign(codeLookup,await once(file))}}
 const anchorsByQuery=[];const choices=normalized.map(q=>{
  const matched=Object.keys(locator).filter(n=>q.toLowerCase().includes(n));const names=matched.filter(n=>!matched.some(o=>o.length>n.length&&o.includes(n)));anchorsByQuery.push(names);
  const files=new Map();for(const name of names)for(const entry of locator[name]){const [file,kinds]=Number.isInteger(entry)?manifest._coverage.files[entry]:entry;files.set(file,kinds)};
  if(options.related&&files.size){const mods=new Set(manifest.shards.filter(s=>files.has(s.file)).flatMap(s=>s.ids||[]));for(const s of manifest.shards)if(s.ids?.some(id=>mods.has(id)))files.set(s.file,s.kinds||['其他'])}
  const referenced=new Set(tokens(q).flatMap(t=>(codeLookup[t]||[]).map(i=>manifest._coverage.files[i][0])));
  const terms=tokens(actionQuery(q));return manifest.shards.map(s=>{const score=terms.reduce((sum,t)=>sum+(s.terms.toLowerCase().includes(t)?(t.length>2?3:1):0),0)+(files.has(s.file)?100:0)+(referenced.has(s.file)?300:0);return {s,score,kinds:files.get(s.file)||s.kinds||['其他']}}).filter(x=>x.score>0&&(!files.size||files.has(x.s.file))).sort((a,b)=>b.score-a.score||a.s.file.localeCompare(b.s.file));
 });
 const picked=new Map();
 // Cover each query and evidence kind in turn; then fill by relevance. A recipe-only
 // subject locator cannot exclude runtime, config or manual evidence anymore.
 const covered=choices.map(()=>new Set());for(let round=0;round<16&&picked.size<16;round++)for(let i=0;i<choices.length;i++){const row=choices[i].find(x=>x.kinds.some(k=>!covered[i].has(k)));if(row){if(picked.size<16)picked.set(row.s.file,row);for(const kind of row.kinds)covered[i].add(kind)}}
 for(let i=0;i<16&&picked.size<16;i++)for(const list of choices){const row=list[i];if(row&&picked.size<16)picked.set(row.s.file,row)}
 const pages=await Promise.all([...picked.keys()].map(once)),all=pages.flat();
 const ranked=normalized.map((q,i)=>{
  const rows=rank(options.related?all.map(f=>({...f,search:(f.search||'')+' '+(f.text||'')})):all,actionQuery(q),options.related?120:36,options.related?[]:anchorsByQuery[i]);if(!options.related)return rows.map((f,i)=>({f:focusRuntime(f,q),score:rows.length-i})).sort((a,b)=>(b.score+(b.f.actionScore||0))-(a.score+(a.f.actionScore||0))).map(x=>x.f);
  const words=[...new Set(tokens(actionQuery(q+' '+q.replace(/([a-z])([A-Z])/g,'$1 $2'))).filter(t=>/^[a-z][a-z0-9_]{4,}$/.test(t)&&!['config','cache','main','data','item','items'].includes(t)))];
  return rows.map((f,index)=>{let bonus=0,line=-1,definitionKey=null;const lines=String(f.text||'').split('\n');for(let j=0;j<lines.length;j++){const m=lines[j].match(/\b(?:public|private|protected)[^;]{0,160}\b([A-Za-z_$][\w$]*)\s*=([^;]+)/);if(m&&words.some(w=>m[1].toLowerCase().startsWith(w))){const concrete=/["']|List\.of|\b(?:true|false|\d+(?:\.\d+)?)\b/.test(m[2]);const exact=words.includes(m[1].toLowerCase());const matches=words.filter(w=>m[1].toLowerCase().includes(w)).length;const score=concrete?(exact?1500:500*Math.max(1,matches)):50;if(score>bonus){bonus=score;line=j;definitionKey=String(f.source||f.mod||'').replace(/:\d+$/,'')+':'+m[1]}}}return {f:line>=0?{...f,definitionKey,retrievalText:lines.slice(Math.max(0,line-3),line+1+Math.max(0,lines.slice(line,line+20).findIndex(text=>/;\s*(?:\/\/.*)?$/.test(text)))).join('\n').slice(0,2600)}:f,score:rows.length-index+bonus}}).sort((a,b)=>b.score-a.score).slice(0,36).map(x=>x.f);
 });const facts=[];
 for(let i=0;i<36;i++)for(const list of ranked){const f=list[i];if(f&&!facts.some(x=>x.id===f.id))facts.push(f)}
 // Keep curated reviewed evidence, and concrete activities appropriate to progress.
 if(manifest.reviewed){const reviewed=await once(manifest.reviewed);facts.unshift(...reviewed.filter(f=>normalized.some((q,i)=>{const relevant=!anchorsByQuery[i].length||anchorsByQuery[i].some(n=>(f.title+' '+(f.labels||[]).join(' ')+' '+f.search).toLowerCase().includes(n));return relevant&&(f.matchAll?.every(g=>g.some(t=>q.includes(t)))||f.topics?.some(t=>q.includes(t)))})))}
 if(normalized.some(recommendation))facts.push(...await activityPool(manifest,normalized[0],once,options));
 return {facts:[...new Map(facts.map(f=>[f.id,f])).values()].slice(0,48),coverage:{queries:normalized,subjects:[...new Set(anchorsByQuery.flat())],readShards:picked.size,totalShards:manifest.shards.length,matchedShards:new Set(choices.flatMap(x=>x.map(r=>r.s.file))).size,evidenceKinds:[...new Set([...picked.values()].flatMap(x=>x.kinds))],bounded:true,note:'搜尋涵蓋多種資料，但本輪最多讀取 16 個資料檔；沒有找到不能推論整包不存在。來源摘要仍須核對條件。'}};
}

export function referenceQueries(facts,q){
 const terms=tokens(actionQuery(q)).filter(t=>/^[a-z][a-z0-9_]*$/.test(t)&&t.length>=4),refs=new Map();
 for(const f of facts.filter(f=>f.runtimeEvidence))for(const ref of String(f.retrievalText||f.text||'').match(/\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*){1,4}/g)||[]){const root=ref.split('.')[0];if(!/^[A-Z]/.test(root)&&!/config|settings|options|rules/i.test(root))continue;if(['Math','String','Integer','Double','Long','Float','List','Set','Map','Arrays','Objects','Optional','InteractionResult','SoundSource','SoundEvents','ParticleTypes'].includes(root))continue;const text=ref.toLowerCase(),score=terms.reduce((sum,t)=>sum+(text.includes(t)?t.length:0),0);refs.set(ref,Math.max(score+(f.actionScore||0)/100,refs.get(ref)||0))}
 return [...refs].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([ref])=>(ref+' '+ref.replace(/([a-z])([A-Z])/g,'$1 $2').split(/[.\s_]+/).filter(t=>t.length>=4&&!/config|cache|^main$|^data$/i.test(t)).join(' ')).slice(0,100));
}
