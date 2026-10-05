// Link only unambiguous names of encounters actually present in this guide.
(()=>{
 const inReader=location.pathname.includes('/guides/'),prefix=inReader?'../':'';
 fetch(prefix+'data/boss-links.json').then(r=>r.json()).then(aliases=>{
  const labels=Object.keys(aliases).sort((a,b)=>b.length-a.length),escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const expression=new RegExp(labels.map(escape).join('|'),'g');
  function scan(){const root=document.querySelector('#main')||document.body;if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let n;
   while(n=walker.nextNode())if(n.parentElement&&!n.parentElement.closest('a,button,input,textarea,select,script,style,h1,h2,h3,h4,summary,.entity-meta,[contenteditable],.complete-check,.reader-progress,.progress-matrix,.item-matrix'))nodes.push(n);
   // Parent dialogs are siblings of #main.
   if(!inReader&&document.querySelector('#modal-body')){const w=document.createTreeWalker(document.querySelector('#modal-body'),NodeFilter.SHOW_TEXT);while(n=w.nextNode())if(!n.parentElement.closest('a,button,input,textarea,select,script,style,h1,h2,h3,h4,summary,[contenteditable],.complete-check'))nodes.push(n)}
   for(const node of nodes){const text=node.textContent;if(text.length>20000)continue;expression.lastIndex=0;const matches=[...text.matchAll(expression)].filter(m=>!/^[a-zA-Z]/.test(m[0])||(!/[a-zA-Z0-9_]/.test(text[m.index-1]||'')&&!/[a-zA-Z0-9_]/.test(text[m.index+m[0].length]||'')));if(!matches.length)continue;const f=document.createDocumentFragment();let last=0;for(const m of matches){f.append(text.slice(last,m.index));const a=document.createElement('a');a.className='boss-reference';a.href='#boss-popup';a.dataset.bossReference=aliases[m[0]];a.textContent=m[0];a.setAttribute('aria-label','查看首領：'+m[0]);f.append(a);last=m.index+m[0].length}f.append(text.slice(last));node.replaceWith(f)}
  }
  let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,80)}).observe(document.body,{childList:true,subtree:true});scan();
  document.addEventListener('click',e=>{const a=e.target.closest('[data-boss-reference],a[href*="record/boss%3A"],a[href*="record/boss:"]');if(!a)return;let id=a.dataset.bossReference;if(!id){try{id=decodeURIComponent(a.getAttribute('href').split('record/')[1]).replace(/^boss:/,'')}catch{return}}if(!Object.values(aliases).includes(id))return;e.preventDefault();e.stopImmediatePropagation();if(inReader)parent.postMessage({type:'boss-reference',slug:new URLSearchParams(location.search).get('atlas'),id},location.origin);else document.dispatchEvent(new CustomEvent('boss-reference',{detail:id}));},true);
 }).catch(()=>{});
})();
