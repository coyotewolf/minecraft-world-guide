// Adapt the complete collection readers without flattening their source content.
const params=new URLSearchParams(location.search);
const slug=params.get('atlas');
function adaptInventoryHints(){
  for(const el of document.querySelectorAll('[data-tip]')){el.dataset.itemHint=el.dataset.tip;el.removeAttribute('data-tip');el.removeAttribute('title');}
  for(const el of document.querySelectorAll('.station'))if(el.querySelector('img')&&!el.dataset.itemHint){el.dataset.itemHint=el.textContent.trim();el.tabIndex=0;el.setAttribute('aria-label',el.dataset.itemHint);for(const span of el.querySelectorAll('span'))span.classList.add('inventory-label');}
  for(const el of document.querySelectorAll('.materialrow'))if(el.querySelector('img'))el.querySelector('.matname')?.classList.add('inventory-label');
}
adaptInventoryHints();let inventoryHintTimer;new MutationObserver(()=>{clearTimeout(inventoryHintTimer);inventoryHintTimer=setTimeout(adaptInventoryHints,20)}).observe(document.body,{childList:true,subtree:true});
// Fill source-reader gaps with genuine inventory artwork from the installed pack.
Promise.all(['icons','names'].map(name=>fetch('../data/'+name+'.json').then(r=>{if(!r.ok)throw Error('Inventory assets unavailable');return r.json()}))).then(([inventory,names])=>{
  const paths=Object.fromEntries(Object.entries(inventory).map(([id,path])=>[id,'../'+path]));
  if(slug==='equipment'&&typeof D!=='undefined'&&D.icons){for(const [id,path]of Object.entries(paths))if(!D.icons[id])D.icons[id]=path;if(typeof current!=='undefined'&&current&&typeof drawDetail==='function')drawDetail(current,false);}
  const labels=new Map();for(const [id,label]of Object.entries(names))if(paths[id]&&label.length>=2&&!label.includes('§'))labels.set(label,id);
  for(const [label,id]of Object.entries({'合成台':'minecraft:crafting_table','工作臺':'minecraft:crafting_table','工作台':'minecraft:crafting_table','鐵砧':'minecraft:anvil'}))if(paths[id])labels.set(label,id);
  function addItemPictures(root){for(const p of root.querySelectorAll('p.method,.processnote,.assemblystep h4,.fields td p')){
    const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT),nodes=[];let node;
    while(node=walker.nextNode())if(!node.parentElement.closest('button,a'))nodes.push(node);
    for(const textNode of nodes){const text=textNode.textContent,matches=[...labels.keys()].filter(label=>text.includes(label)).sort((a,b)=>b.length-a.length);if(!matches.length)continue;
      const regex=new RegExp(matches.map(label=>label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g'),fragment=document.createDocumentFragment();let last=0;
      for(const m of text.matchAll(regex)){fragment.append(text.slice(last,m.index));const id=labels.get(m[0]),button=document.createElement('button');button.className='guide-inline-item';button.dataset.inventoryItem=id;const im=document.createElement('img');im.src=paths[id];im.alt='';im.width=20;im.height=20;button.append(im,document.createTextNode(m[0]));fragment.append(button);last=m.index+m[0].length;}fragment.append(text.slice(last));textNode.replaceWith(fragment);
    }
  }}
  addItemPictures(document);let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>addItemPictures(document),60)}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-inventory-item]');if(b){e.preventDefault();parent.postMessage({type:'guide-item',slug,id:b.dataset.inventoryItem},location.origin);}});
}).catch(()=>{});
const find=id=>document.getElementById(id);
const input=(id,value)=>{const e=find(id);if(e){e.value=value;e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));}};
function openTarget(d){
  if(slug==='equipment'){
    if(d.done==='done')document.querySelector('[data-tab="done"]')?.click();
    if(d.query){document.querySelector('[data-view="all"]')?.click();input('search',d.query);}
    if(d.id&&typeof drawDetail==='function')drawDetail(d.id);
  }else if(slug==='skills'){
    // Reference entries live in a separate source collection; select it before searching.
    if(d.reference||d.done==='reference')find('referenceView')?.click();
    if(d.done==='done'||d.done==='todo')input('state',d.done);
    if(d.query||d.id)input('search',d.query||d.id);
    if(d.id){const entryId='entry-'+d.id.replace(/[^a-z0-9]/g,'-');if(!find(entryId))input('search',d.id);const entry=find(entryId);if(entry){entry.open=true;entry.scrollIntoView({block:'start',behavior:'instant'});}}
  }else if(slug==='bosses'){
    const pet=d.view==='pets'||d.view==='mounts';
    document.querySelector(`[data-view="${d.view||'boss'}"]`)?.click();
    if(d.done==='done'||d.done==='todo')input(pet?'pet-state':'state',pet?(d.done==='done'?'tamed':'pending'):(d.done==='done'?'won':'unloot'));
    if(d.query)input(pet?'pet-search':'search',d.query);
    if(d.id){
      const c=[...document.querySelectorAll('[data-id],[data-pet-id]')].find(c=>c.dataset.id===d.id||c.dataset.petId===d.id);
      if(c){const isPet=!!c.dataset.petId;document.querySelector(`[data-view="${isPet?'pets':'boss'}"]`)?.click();input(isPet?'pet-search':'search',d.id);c.querySelectorAll('details').forEach(e=>e.open=true);c.scrollIntoView({block:'start',behavior:'instant'});}
    }
  }else if(slug==='scarlet'){
    if(d.id&&find(d.id)){location.hash=d.id;window.dispatchEvent(new HashChangeEvent('hashchange'));}
    else if(d.query)input('search',d.query);
  }
}
if(slug){
  document.documentElement.dataset.atlas=slug;
  for(const title of document.querySelectorAll('.modulehead h2')){
    const text=title.textContent.trim(),match=text.match(/^([^A-Za-z]+?)\s+([A-Za-z].*)$/);
    if(match){title.textContent='';const label=document.createElement('span'),alias=document.createElement('span');label.className='module-name';alias.className='module-alias';label.textContent=match[1];alias.textContent=match[2];title.append(label,alias);}
  }
  // Remove promotional reader introductions, preserving actual game instructions.
  document.querySelectorAll('header.masthead .mark,header.masthead p,header.hero > p:not([id]),header.hero .topline .brand,.collection-source-note').forEach(e=>e.remove());
  if(slug==='equipment')document.querySelector('header.hero h1').textContent='裝備收藏冊';
  if(slug==='scarlet')document.querySelector('header.masthead h1').textContent='緋紅獵人攻略';
  if(slug==='bosses'){
    document.querySelector('.collection-tabs')?.setAttribute('hidden','');
    for(const card of document.querySelectorAll('.pet-card')){
      const seen=new Set();
      for(const label of card.querySelectorAll('.pet-capability')){const text=label.textContent.trim();if(seen.has(text))label.remove();else seen.add(text)}
      for(const list of card.querySelectorAll('dl')){
        const pairs=new Set();
        for(const term of [...list.querySelectorAll('dt')]){const value=term.nextElementSibling;if(value?.tagName!=='DD')continue;const key=term.textContent.trim()+'\n'+value.textContent.trim();if(pairs.has(key)){term.remove();value.remove()}else pairs.add(key)}
      }
    }
    const title=document.querySelector('header.hero h1');
    const row=document.createElement('div');row.className='boss-heading-row';title.before(row);row.append(title);
    document.querySelector('header.hero .numbers')?.remove();
    find('organ-health-note')?.remove();
    const controls=document.createElement('div');controls.className='boss-heading-controls';row.append(controls);
    const expand=find('expand'),collapse=find('collapse'),expandBoss=expand.onclick,collapseBoss=collapse.onclick;
    // Original handlers are initialized before this deferred adapter runs.
    expand.parentElement.hidden=true;find('pet-open').parentElement.hidden=true;
    for(const id of ['export','import','pet-export','pet-import'])find(id)?.remove();
    for(const [button,label,plus] of [[expand,'全部展開',true],[collapse,'全部收合',false]]){
      button.type='button';button.removeAttribute('title');button.dataset.itemHint=label;button.setAttribute('aria-label',label);
      button.innerHTML=`<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14${plus?'M12 5v14':''}"/></svg>`;
      controls.append(button);
    }
    const petsSelected=()=>!!document.querySelector('[data-view="pets"][aria-selected="true"],[data-view="mounts"][aria-selected="true"]');
    expand.onclick=e=>petsSelected()?find('pet-open').click():expandBoss.call(expand,e);
    collapse.onclick=e=>petsSelected()?find('pet-close').click():collapseBoss.call(collapse,e);
  }
  const topButton=document.createElement('button');
  topButton.id='atlas-back-top';topButton.type='button';topButton.hidden=true;
  topButton.dataset.itemHint='回到最上面';topButton.setAttribute('aria-label','回到最上面');
  topButton.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5h14M12 20V9M6 15l6-6 6 6"/></svg>';
  document.body.append(topButton);
  const updateTopButton=()=>{topButton.hidden=window.scrollY<280};
  addEventListener('scroll',updateTopButton,{passive:true});updateTopButton();
  topButton.onclick=()=>window.scrollTo({top:0,behavior:document.documentElement.dataset.motion==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  const dock=slug==='equipment'?document.querySelector('.navigation'):null;
  if(dock)document.querySelector('.shell')?.prepend(dock);
  if(slug==='equipment')new MutationObserver(()=>{
    for(const p of document.querySelectorAll('.settingsblock p')){
      if(p.textContent.includes('收藏、目標與筆記會保存在目前的瀏覽器。'))p.textContent=p.textContent.replace('收藏、目標與筆記會保存在目前的瀏覽器。','登入後，收藏、目標與筆記會同步到你的帳號；訪客紀錄保存在目前瀏覽器。');
      if(p.textContent.startsWith('換手機、瀏覽器或移動檔案前'))p.textContent='登入帳號可在其他裝置接續紀錄。也可以先備份收藏，再用「還原收藏」匯入之前 HTML 匯出的進度。';
    }
  }).observe(find('detail'),{childList:true,subtree:true});
  addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='atlas-open')openTarget(e.data);});
  // Keep original recipes, descriptions, images, filters and export/import handlers intact.
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-id],[data-pet-id],.entry');
    if(!b)return;
    const id=b.dataset.id||b.dataset.petId||b.querySelector('[data-id]')?.dataset.id;
    if(id)parent.postMessage({type:'atlas-location',slug,id},location.origin);
  });
}
