// Preserve Java branch structure, including closing and failure branches.
// Strings/comments may contain braces and must not change the routine boundary.
export function routineExcerpt(text,start=0,limit=2600){
 let quote='',comment='',escape=false,depth=0,opened=false,end=-1;
 for(let i=start;i<text.length;i++){
  const c=text[i],next=text[i+1];
  if(comment==='line'){if(c==='\n')comment='';continue}
  if(comment==='block'){if(c==='*'&&next==='/'){comment='';i++}continue}
  if(quote){if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c===quote)quote='';continue}
  if(c==='/'&&next==='/'){comment='line';i++;continue}if(c==='/'&&next==='*'){comment='block';i++;continue}
  if(c==='"'||c==="'"){quote=c;continue}
  if(c==='{'){opened=true;depth++}if(c==='}'&&opened&&--depth===0){end=i+1;break}
 }
 const raw=text.slice(start,end<0?text.length:end),complete=end>=0&&raw.length<=limit;
 const excerpt=raw.length<=limit?raw:raw.slice(0,Math.floor(limit*.65))+'\n[中間程式超出本輪長度，條件可能不完整]\n'+raw.slice(-Math.floor(limit*.3));
 return {text:excerpt,complete,reason:end<0?'來源視窗未包含函式結尾':raw.length>limit?'函式超過本輪長度，保留開頭與結尾':'本輪保留完整函式；呼叫的其他定義仍須另查'};
}
