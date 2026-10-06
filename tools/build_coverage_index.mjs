import fs from 'node:fs';
const base=new URL('../data/ai/',import.meta.url),read=file=>JSON.parse(fs.readFileSync(new URL(file,base),'utf8'));
const manifest=read('manifest.json'),subjects={},counts={},codeTerms=new Map();let facts=0;
// All evidence types participate, including runtime behavior that used to lose
// to recipe shards. This is a locator, never proof of a mechanic by itself.
for(const [position,shard] of manifest.shards.entries()){
 const rows=read(shard.file);facts+=rows.length;
 for(const f of rows){
  if(f.runtimeEvidence){for(const word of new Set((f.text||'').match(/\b[A-Za-z][A-Za-z0-9_]*[A-Z][A-Za-z0-9_]*\b/g)||[])){if(word.length<5)continue;const key=word.toLowerCase();if(!codeTerms.has(key))codeTerms.set(key,new Set());const refs=codeTerms.get(key);if(refs.size<=32)refs.add(position)}}
  const kind=f.title?.split(' · ')[0]||'其他';counts[kind]=(counts[kind]||0)+1;
  const names=new Set((f.labels||[]).flatMap(label=>{
   const match=label.match(/^(.+?)\s*\(([a-z0-9_.-]+:[a-z0-9_./-]+)\)$/i);
   return match?[match[1],match[2]]:[label];
  }).filter(name=>name.length>=2&&name.length<=80&&!/[:/]/.test(name.replace(/^[a-z0-9_.-]+:[a-z0-9_./-]+$/i,''))));
  for(const name of names){const key=name.toLowerCase();subjects[key]??={};subjects[key][shard.file]??=new Set();subjects[key][shard.file].add(kind)}
 }
}
for(const [name,files] of Object.entries(read(manifest.entityIndex))){subjects[name]??={};for(const file of files){subjects[name][file]??=new Set();for(const kind of manifest.shards.find(s=>s.file===file)?.kinds||[])subjects[name][file].add(kind)}}
const files=manifest.shards.map(s=>[s.file,s.kinds||[]]),positions=new Map(files.map((row,i)=>[row[0],i]));
const out={version:manifest.version,facts,shards:manifest.shards.length,kinds:counts,files,subjects:Object.fromEntries(Object.entries(subjects).map(([name,entries])=>[name,Object.keys(entries).map(file=>positions.get(file)).filter(i=>i!==undefined)]))};
const buckets={};for(const [word,refs] of codeTerms)if(refs.size<=32){const prefix=word[0];buckets[prefix]??={};buckets[prefix][word]=[...refs]}
out.codeLookup={};for(const [prefix,rows] of Object.entries(buckets)){const file='code-lookup-'+prefix+'.json';out.codeLookup[prefix]=file;fs.writeFileSync(new URL(file,base),JSON.stringify(rows))}
fs.writeFileSync(new URL('coverage-index.json',base),JSON.stringify(out));
console.log('Coverage index:',facts,'facts,',Object.keys(subjects).length,'subjects,',Object.keys(counts).length,'evidence kinds');
