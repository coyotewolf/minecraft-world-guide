// Keep exactly one authoritative progress summary after the native adapters finish.
(()=>{
 const slug=document.documentElement.dataset.atlas;if(!slug)return;
 function addAcquisition(){
  if(slug!=='equipment'||typeof D==='undefined')return;
  for(const card of document.querySelectorAll('#content .card')){
   const id=card.querySelector('[data-open]')?.dataset.open;if(!id||card.querySelector('.collection-brief'))continue;
   const d=document.createElement('details');d.className='collection-brief';d.innerHTML='<summary>取得與材料</summary>';
   d.addEventListener('toggle',()=>{if(!d.open||d.dataset.loaded)return;d.dataset.loaded='true';const body=document.createElement('div');body.innerHTML=acquisitionPanel(D.nodes[id]||{recipes:[],loot:[]});for(const b of body.querySelectorAll('[data-detailtab]')){b.removeAttribute('data-detailtab');b.dataset.open=id;b.textContent='查看完整攻略'}d.append(body)});
   card.append(d);d.open=document.documentElement.dataset.equipmentExpanded==='true';
  }
 }
 function normalize(){
  for(const b of document.querySelectorAll('#atlas-quickbar [data-atlas-expand],#atlas-quickbar [data-atlas-collapse],.atlas-wish-button')){b.dataset.itemHint=b.getAttribute('aria-label')||b.title;b.removeAttribute('title');}
  if(slug==='equipment'){
   const progress=document.querySelector('.reader-progress'),heading=document.getElementById('atlas-quickbar');
   if(progress&&heading&&heading.nextElementSibling!==progress)heading.after(progress);
   document.querySelectorAll('.atlas-equipment-progress').forEach(p=>p.hidden=true);
   addAcquisition();
  }
 }
 normalize();addEventListener('DOMContentLoaded',normalize);
 document.getElementById('atlas-quickbar')?.addEventListener('click',e=>{
  if(slug!=='equipment')return;const b=e.target.closest('[data-atlas-expand],[data-atlas-collapse]');if(!b)return;
  const expand=b.hasAttribute('data-atlas-expand');document.documentElement.dataset.equipmentExpanded=String(expand);
  if(expand)setView('all');addAcquisition();document.querySelectorAll('.collection-brief').forEach(d=>d.open=expand);
  document.querySelectorAll('.filter-drawer').forEach(d=>d.open=false);
 });
 let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(normalize,40)}).observe(document.body,{childList:true,subtree:true});
 fetch('../data/mod-labels.json',{cache:'no-cache'}).then(r=>r.json()).then(labels=>{
  const aliases={};if(slug==='skills'&&typeof collectible!=='undefined')for(const entry of collectible){const ns=entry.id.split(':')[0];if(labels[ns])aliases[entry.mod]=labels[ns]}function translate(){for(const select of document.querySelectorAll('select'))if(/mod/i.test(select.id)||select.querySelector('option[value="alexsmobs"]'))for(const option of select.options){if(option.value&&(labels[option.value]||aliases[option.value])&&option.textContent!==(labels[option.value]||aliases[option.value]))option.textContent=labels[option.value]||aliases[option.value];}}
  translate();let pending;new MutationObserver(()=>{clearTimeout(pending);pending=setTimeout(translate,60)}).observe(document.body,{childList:true,subtree:true});
 }).catch(()=>{});
})();
