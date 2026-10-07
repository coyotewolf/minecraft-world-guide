// Names locate evidence; a matching translation never proves a mechanic.
const typeWords={enchantment:/附魔|魔咒|enchant/i,effect:/狀態|效果|status effect/i};
function includesName(query,name){
 if(typeof name!=='string')return false;
 const q=query.toLowerCase(),n=name.toLowerCase();if(n.length<2)return false;
 if(/[a-z]/i.test(n)){const escaped=n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(?<![a-z0-9_])'+escaped+'(?![a-z0-9_])','i').test(q)}
 return q.includes(n);
}
export function resolveSubjects(registry,query){
 const requested=typeWords.enchantment.test(query)?['enchantment',...(/狀態效果|藥水效果|status effect/i.test(query)?['effect']:[])]:typeWords.effect.test(query)?['effect']:[];
 const rows=(registry?.records||[]).filter(r=>!requested.length||requested.includes(r.type)).filter(r=>[r.id,r.translationKey,r.name,...(r.aliases||[])].some(name=>includesName(query,name)&&(requested.length||name.length>2||query.includes('「'+name+'」')||query.includes('"'+name+'"'))));
 // Prefer the longest matched name, but keep different registries with the same
 // display name so the answer can disambiguate rather than silently choose one.
 return rows.filter(r=>!rows.some(other=>other.id!==r.id&&[other.name,...(other.aliases||[])].some(long=>includesName(query,long)&&[r.name,...(r.aliases||[])].some(short=>long.length>short.length&&long.includes(short)&&includesName(query,short)))));
}
export function subjectFact(row,shard){
 const kind=row.type==='enchantment'?'附魔':'狀態效果';
 return {id:'registry:'+row.type+':'+row.id,title:kind+' · '+row.name,playerTitle:row.name+'（'+kind+'）',playerSummary:row.reviewedSummary||kind+'名稱：'+row.name+'。'+(row.description?'模組內說明：'+row.description:'目前只有名稱對照，尚須查核效果程式；名稱本身不能推論用途。'),text:row.reviewedSummary||row.description||row.name,labels:[row.id,row.translationKey,row.name,...row.aliases],source:row.reviewedSources?.join('\n')||row.source,shard,sha256:row.sha256,evidenceScope:row.scope,registrySubject:{id:row.id,type:row.type},search:[kind,row.id,row.translationKey,row.name,...row.aliases].join(' ')};
}
