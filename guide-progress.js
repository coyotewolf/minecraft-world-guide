// Translate the supplied guides' storage formats into the unified player journal.
const SPECS={skills:['skills-spells-collection-v1','skills:'],equipment:['equipment-atlas-1.20.1-v1','equipment:']};
const parse=(s,fallback)=>{try{return JSON.parse(s)||fallback}catch{return fallback}};
export function readGuide(slug,data){
 const out=new Map();
 if(slug==='skills')for(const id of parse(data[SPECS.skills[0]],[]))out.set('skills:'+id,{completed:true});
 if(slug==='equipment'){
  const s=parse(data[SPECS.equipment[0]],{});
  for(const id of s.done||[])out.set('equipment:'+id,{completed:true});
  for(const [id,notes] of Object.entries(s.notes||{}))out.set('equipment:'+id,{...(out.get('equipment:'+id)||{completed:false}),notes:String(notes).slice(0,8000)});
 }
 if(slug==='bosses')for(const [storage,prefix,field] of [['mc-boss-collection-v1','boss:','loot'],['mc-taming-collection-v1','companion:','tamed']]){
  for(const [id,p] of Object.entries(parse(data[storage],{}).progress||{}))out.set(prefix+id,{completed:!!p[field],...(typeof p.note==='string'?{notes:p.note.slice(0,8000)}:{})});
 }
 return out;
}
export function writeGuide(slug,data,records,collections){
 const result={...data},rows=collections.filter(c=>c.sourceGuide===slug&&c.collectible);
 if(slug==='skills')result[SPECS.skills[0]]=JSON.stringify(rows.filter(c=>records.get(c.key)?.completed).map(c=>c.id));
 if(slug==='equipment'){
  const s=parse(data[SPECS.equipment[0]],{wish:[],notes:{}});s.done=rows.filter(c=>records.get(c.key)?.completed).map(c=>c.id);s.notes=s.notes||{};
  for(const c of rows){const p=records.get(c.key);if(p&&'notes'in p)s.notes[c.id]=p.notes}
  result[SPECS.equipment[0]]=JSON.stringify(s);
 }
 if(slug==='bosses')for(const [storage,prefix,field] of [['mc-boss-collection-v1','boss:','loot'],['mc-taming-collection-v1','companion:','tamed']]){
  const s=parse(data[storage],{schema:1,progress:{}});s.progress=s.progress||{};
  for(const c of rows.filter(c=>c.key.startsWith(prefix))){const p=records.get(c.key);s.progress[c.id]={...s.progress[c.id],[field]:!!p?.completed};if(p&&'notes'in p)s.progress[c.id].note=p.notes}
  result[storage]=JSON.stringify(s);
 }
 return result;
}
