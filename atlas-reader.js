// Adapt the complete collection readers without flattening their source content.
const params=new URLSearchParams(location.search);
const slug=params.get('atlas');
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
  // Remove promotional reader introductions, preserving actual game instructions.
  document.querySelectorAll('header.masthead .mark,header.masthead p,header.hero > p:not([id]),header.hero .topline .brand').forEach(e=>e.remove());
  if(slug==='equipment')document.querySelector('header.hero h1').textContent='裝備收藏冊';
  if(slug==='scarlet')document.querySelector('header.masthead h1').textContent='緋紅獵人攻略';
  if(slug==='bosses'){
    const title=document.querySelector('header.hero h1');
    const row=document.createElement('div');row.className='boss-heading-row';title.before(row);row.append(title);
    document.querySelector('header.hero .numbers')?.remove();
    find('organ-health-note')?.remove();
    const controls=document.createElement('div');controls.className='boss-heading-controls';row.append(controls);
    const hint=document.createElement('div');hint.id='atlas-control-hint';hint.setAttribute('role','tooltip');hint.hidden=true;document.body.append(hint);
    let hintTimer,hintKeepUntil=0;
    const hideHint=(force=false)=>{if(force!==true&&Date.now()<hintKeepUntil)return;clearTimeout(hintTimer);hintKeepUntil=0;hint.hidden=true};
    const expand=find('expand'),collapse=find('collapse'),expandBoss=expand.onclick,collapseBoss=collapse.onclick;
    // Original handlers are initialized before this deferred adapter runs.
    expand.parentElement.hidden=true;find('pet-open').parentElement.hidden=true;
    for(const id of ['export','import','pet-export','pet-import'])find(id)?.remove();
    for(const [button,label,plus] of [[expand,'全部展開',true],[collapse,'全部收合',false]]){
      button.type='button';button.title=label;button.setAttribute('aria-label',label);
      button.innerHTML=`<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14${plus?'M12 5v14':''}"/></svg>`;
      button.setAttribute('aria-describedby',hint.id);
      let holdTimer,held=false,origin;
      const showHint=()=>{clearTimeout(hintTimer);if(held)hintKeepUntil=Date.now()+3000;hint.textContent=label;hint.hidden=false;const r=button.getBoundingClientRect();hint.style.left=Math.max(8,Math.min(innerWidth-hint.offsetWidth-8,r.left+r.width/2-hint.offsetWidth/2))+'px';hint.style.top=Math.min(innerHeight-hint.offsetHeight-8,r.bottom+8)+'px'};
      button.addEventListener('pointerdown',e=>{if(e.button!==0)return;hideHint(true);held=false;origin={x:e.clientX,y:e.clientY};holdTimer=setTimeout(()=>{held=true;showHint()},450)});
      button.addEventListener('pointermove',e=>{if(origin&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>10){clearTimeout(holdTimer);hideHint()}});
      button.addEventListener('pointerup',()=>{clearTimeout(holdTimer);origin=null;if(held){hintKeepUntil=Date.now()+3000;hintTimer=setTimeout(hideHint,3000)}});
      button.addEventListener('pointercancel',()=>{clearTimeout(holdTimer);origin=null;if(held)hintTimer=setTimeout(hideHint,3000);else hideHint()});
      button.addEventListener('contextmenu',e=>{e.preventDefault();clearTimeout(holdTimer);held=true;showHint();hintTimer=setTimeout(hideHint,3000)});
      button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')showHint()});
      button.addEventListener('pointerleave',()=>{clearTimeout(holdTimer);origin=null;if(!held)hideHint()});
      button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))showHint()});
      button.addEventListener('blur',hideHint);
      button.addEventListener('click',e=>{if(held){held=false;e.preventDefault();e.stopImmediatePropagation()}},true);
      controls.append(button);
    }
    const petsSelected=()=>!!document.querySelector('[data-view="pets"][aria-selected="true"],[data-view="mounts"][aria-selected="true"]');
    expand.onclick=e=>petsSelected()?find('pet-open').click():expandBoss.call(expand,e);
    collapse.onclick=e=>petsSelected()?find('pet-close').click():collapseBoss.call(collapse,e);
  }
  const topButton=document.createElement('button');
  topButton.id='atlas-back-top';topButton.type='button';topButton.hidden=true;
  topButton.title='回到最上面';topButton.setAttribute('aria-label','回到最上面');
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
