export const displayName=s=>String(s||'').replace(/\s*\([a-z0-9_.-]+:[^)]*\)/g,'');
export function playerEvidence(f){
 const names=(f.labels||[]).map(displayName).filter(n=>n&&!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(n));
 const title=f.playerTitle||((f.title||'').includes(' · ')?(f.title.split(' · ')[0]+'：'+names.slice(0,3).join('、')):f.title);
 let text=f.playerSummary;
 if(!text&&f.runtimeEvidence)text='已查核此功能的程式行為。回答會整理與問題有關的條件與限制；原始程式保留在來源資料中。';
 if(!text&&!/^[\s]*[\[{]/.test(f.text||'')&&!f.source?.endsWith('.json'))text=(f.text||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/<[^>]*>/g,'').slice(0,1800);
 if(!text)text='找到'+(names.slice(0,5).join('、')||'相關內容')+'的資料，但目前沒有足夠依據確認具體操作或機率。';
 return {title,text};
}
function flatten(value,path='',out=[]){
 if(out.length>=32)return out;
 if(value===null||value===undefined)return out;
 if(Array.isArray(value)){for(let i=0;i<Math.min(value.length,12);i++)flatten(value[i],path?path+'['+i+']':'['+i+']',out);return out}
 if(typeof value==='object'){
  for(const [key,val] of Object.entries(value)){
   if(out.length>=32)break;
   if(['texture','textures','model','sound','sounds','particle','particles'].includes(key))continue;
   flatten(val,path?path+'.'+key:key,out);
  }
  return out;
 }
 if(['string','number','boolean'].includes(typeof value))out.push((path||'value')+' = '+String(value));
 return out;
}
export function modelEvidence(f){
 const shown=playerEvidence(f);
 if(f.runtimeEvidence)return {title:f.title,text:'解包片段，必須檢查條件；片段未出現某行為不能證明不存在。\n'+String(f.text||'').slice(0,2200)};
 if(f.playerSummary)return shown;
 const raw=String(f.text||'').trim();
 if(!raw.match(/^[\[{]/))return shown;
 try{
  const parsed=JSON.parse(raw),lines=flatten(parsed);
  if(lines.length)return {title:shown.title,text:lines.join('\n').slice(0,2600)};
 }catch{}
 return shown;
}
