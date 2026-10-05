// Retain source event handlers and storage; move controls into one native drawer.
(()=>{
 const slug=document.documentElement.dataset.atlas;
 if(!slug)return;
 const popupId=new URLSearchParams(location.search).get('bossPopup');
 if(slug==='bosses'&&popupId){document.documentElement.dataset.bossPopup='true';const card=[...document.querySelectorAll('.card[data-id]')].find(c=>c.dataset.id===popupId);if(card){card.dataset.popupSelected='true';card.querySelectorAll('details').forEach(d=>d.open=true)}document.getElementById('back-to-top')?.remove();}
 function drawer(host,controls,oldButton){
  if(!host||!controls)return;
  const d=document.createElement('details'),summary=document.createElement('summary');d.className='filter-drawer unified-filter';summary.textContent='篩選';
  if(oldButton){summary.id=oldButton.id;const count=oldButton.querySelector('#filterCount');if(count)summary.append(' ',count);oldButton.replaceWith(d)}else host.append(d);
  d.append(summary,controls);controls.hidden=false;controls.classList.add('filter-options');
 }
 if(slug==='equipment'){
  document.querySelectorAll('.searchbar>span[aria-hidden]').forEach(e=>e.remove());
  const title=document.querySelector('header.hero h1'),settings=document.getElementById('settings'),row=document.createElement('div');row.className='reader-heading-row';title.before(row);row.append(title,settings);document.querySelector('header.hero .topline')?.remove();
  drawer(document.querySelector('.searchbar'),document.getElementById('filters'),document.getElementById('toggleFilters'));
  const search=document.querySelector('.searchbar>input');if(search){const box=document.createElement('div');box.className='searchbox';box.innerHTML='<svg aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"></circle><path d="m15 15 5 5"></path></svg>';search.before(box);box.append(search);}
 }
 if(slug==='skills'){
  // Reference records have no obtainable route in this pack; never expose them.
  const originalScope=scope;scope=()=>originalScope(false);scope(false);
  for(const e of document.querySelectorAll('.overview,.help,.two,.switcher,#scopeNote,.catalogue>aside'))e.hidden=true;
  document.getElementById('referenceView').onclick=()=>scope(false);
  const controls=document.querySelector('.filterbox .filters');controls.prepend(document.getElementById('modSelect'));drawer(document.querySelector('.toolbar-inner'),controls);
 }
 if(slug==='scarlet'){
  const controls=document.createElement('div');controls.append(document.getElementById('chapter'));drawer(document.querySelector('.toolbar-inner'),controls);
  let saved=[];try{saved=JSON.parse(localStorage.getItem('scarlet-chapter-progress-v1')||'[]')}catch{}
  for(const chapter of document.querySelectorAll('.chapter[id]')){
   const label=document.createElement('label'),input=document.createElement('input');label.className='chapter-complete';input.type='checkbox';input.checked=saved.includes(chapter.id);input.dataset.chapterComplete=chapter.id;label.append(input,'我已完成本章實作');chapter.append(label);
  }
  document.addEventListener('change',e=>{if(e.target.dataset.chapterComplete){const ids=[...document.querySelectorAll('[data-chapter-complete]:checked')].map(i=>i.dataset.chapterComplete);localStorage.setItem('scarlet-chapter-progress-v1',JSON.stringify(ids));updateProgress()}});
 }
 const progress=document.createElement('section');progress.className='reader-progress';progress.setAttribute('aria-label','收藏進度');
 const header=document.querySelector('header.hero,.masthead');header.after(progress);
 function load(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}}
 function updateProgress(){
  let total=0,done=0,title='收藏進度';
  if(slug==='equipment'){total=Number(document.getElementById('totalStat')?.textContent.replace(/,/g,''))||1383;done=load('equipment-atlas-1.20.1-v1',{}).done?.length||0}
  else if(slug==='skills'){const ids=new Set(collectible.map(x=>x.id));total=ids.size;done=load('skills-spells-collection-v1',[]).filter(id=>ids.has(id)).length}
  else if(slug==='scarlet'){total=document.querySelectorAll('[data-chapter-complete]').length;done=document.querySelectorAll('[data-chapter-complete]:checked').length;title='章節完成進度'}
  else if(slug==='bosses'){
   const view=document.body.dataset.collectionView||'boss',pets=view!=='boss';
   document.querySelector('header.hero h1').textContent={boss:'首領與事件',pets:'夥伴收藏冊',mounts:'坐騎收藏冊'}[view];
   const cards=[...document.querySelectorAll(pets?'.pet-card':'.module .card[data-id]')].filter(c=>view!=='mounts'||c.dataset.petMount!=='no');total=cards.length;
   const data=load(pets?'mc-taming-collection-v1':'mc-boss-collection-v1',{}).progress||{};
   done=cards.filter(c=>data[pets?c.dataset.petId:c.dataset.id]?.[pets?'tamed':'loot']).length;if(pets){const meta=document.getElementById('pet-status'),text=`顯示 ${cards.filter(c=>!c.hidden).length} / ${total} 項`;if(meta&&meta.textContent!==text)meta.textContent=text;}
  }
  const percent=total?Math.round(done/total*100):0,html=`<div><span>${title}</span><span>${done} / ${total}</span></div><div class="reader-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${percent}%"></i></div>`;
  if(progress.innerHTML!==html)progress.innerHTML=html;
 }
 updateProgress();
 document.addEventListener('change',()=>setTimeout(updateProgress,0));
 let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(updateProgress,60)}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-collection-view']});
 document.addEventListener('click',e=>{for(const d of document.querySelectorAll('.filter-drawer[open]'))if(!d.contains(e.target))d.open=false});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.filter-drawer').forEach(d=>d.open=false)});
})();
