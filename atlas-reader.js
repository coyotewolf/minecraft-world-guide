// Adapt the complete collection readers without flattening their source content.
const params=new URLSearchParams(location.search);
const slug=params.get('atlas');
const atlasPopup=params.get('popup')==='1'||params.has('bossPopup');
if(atlasPopup)document.documentElement.dataset.atlasPopup='true';
function adaptInventoryHints(){
  for(const el of document.querySelectorAll('[data-tip]')){el.dataset.itemHint=el.dataset.tip;el.removeAttribute('data-tip');el.removeAttribute('title');}
  for(const el of document.querySelectorAll('.station'))if(el.querySelector('img')&&!el.dataset.itemHint){el.dataset.itemHint=el.textContent.trim();el.tabIndex=0;el.setAttribute('aria-label',el.dataset.itemHint);for(const span of el.querySelectorAll('span'))span.classList.add('inventory-label');}
  for(const el of document.querySelectorAll('.materialrow'))if(el.querySelector('img'))el.querySelector('.matname')?.classList.add('inventory-label');
}
adaptInventoryHints();let inventoryHintTimer;new MutationObserver(()=>{clearTimeout(inventoryHintTimer);inventoryHintTimer=setTimeout(()=>{adaptInventoryHints();applyAtlasWishes()},20)}).observe(document.body,{childList:true,subtree:true});
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

function atlasEntryId(el){
 if(el.dataset.petId)return el.dataset.petId;
 if(el.dataset.id)return el.dataset.id;
 return el.querySelector('[data-id]')?.dataset.id||'';
}
let atlasWishes=new Set(),atlasMode='all';
function atlasRows(){
 if(slug==='bosses')return [...document.querySelectorAll('.card[data-id],.pet-card[data-pet-id]')];
 if(slug==='skills')return [...document.querySelectorAll('.entry')];
 return [];
}
function applyAtlasWishes(){
 for(const row of atlasRows()){
  const id=atlasEntryId(row);if(!id)continue;
  row.dataset.atlasWish=atlasWishes.has(id)?'1':'0';
  let b=row.querySelector('.atlas-wish-button[data-atlas-wish-toggle="'+CSS.escape(id)+'"]');
  if(!b){
   b=document.createElement('button');b.type='button';b.className='atlas-wish-button';b.dataset.atlasWishToggle=id;
   b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const next=!atlasWishes.has(id);next?atlasWishes.add(id):atlasWishes.delete(id);applyAtlasWishes();parent.postMessage({type:'atlas-wish',slug,id,wanted:next},location.origin)});
   const target=row.matches('.entry')?(row.querySelector('.entry-title')||row.querySelector('summary')):(row.querySelector('.cardtop')||row);
   target?.append(b);
  }
  if(b){b.textContent=atlasWishes.has(id)?'★':'☆';b.title=atlasWishes.has(id)?'從想收集移除':'加入想收集';b.setAttribute('aria-label',b.title)}
  if(atlasMode==='wish')row.hidden=!atlasWishes.has(id);
 }
}
function setAtlasMode(mode){
 atlasMode=['all','wish','done','materials'].includes(mode)?mode:'all';
 document.querySelectorAll('[data-atlas-mode]').forEach(b=>b.classList.toggle('active',b.dataset.atlasMode===atlasMode));
 if(slug==='equipment'){
  const map={all:'all',wish:'wish',done:'done',materials:'materials'};document.querySelector('[data-tab="'+map[atlasMode]+'"]')?.click();return;
 }
 if(mode==='done'){
  if(slug==='skills')input('state','done');
  else if(slug==='bosses'){const pet=!!document.querySelector('[data-view="pets"][aria-selected="true"],[data-view="mounts"][aria-selected="true"]');input(pet?'pet-state':'state',pet?'tamed':'won')}
 }else if(mode==='all'){
  if(slug==='skills')input('state','');
  else if(slug==='bosses'){input('state','');input('pet-state','')}
 }
 for(const row of atlasRows())row.hidden=mode==='wish'?!atlasWishes.has(atlasEntryId(row)):false;
 applyAtlasWishes();
}
function atlasTitle(){
 const section=params.get('section');
 if(section==='equipment')return '裝備圖鑑';
 if(section==='skills')return '技能與法術圖鑑';
 if(section==='companions')return '夥伴圖鑑';
 if(section==='mounts')return '坐騎圖鑑';
 if(section==='bosses')return '首領與事件圖鑑';
 if(section==='strategy'||slug==='scarlet')return '緋紅獵人實戰手冊';
 if(slug==='equipment')return '裝備圖鑑';
 if(slug==='skills')return '技能與法術圖鑑';
 if(slug==='bosses')return '首領・夥伴・坐騎圖鑑';
 return '收藏圖鑑';
}
function installAtlasQuickbar(){
 if(document.getElementById('atlas-quickbar'))return;
 const bar=document.createElement('div');bar.id='atlas-quickbar';
 const menu=slug==='scarlet'?'':'<details class="atlas-menu"><summary aria-label="收藏冊選單">☰</summary><div class="atlas-menu-panel"><button type="button" data-atlas-mode="all">圖鑑</button><button type="button" data-atlas-mode="wish">☆ 想收集</button><button type="button" data-atlas-mode="done">✓ 已取得</button>'+(slug==='equipment'?'<button type="button" data-atlas-mode="materials">素材</button>':'')+'</div></details>';
 bar.innerHTML=menu+'<strong class="atlas-quick-title">'+atlasTitle()+'</strong><span class="atlas-quick-spacer"></span><button type="button" data-atlas-expand aria-label="全部展開">＋</button><button type="button" data-atlas-collapse aria-label="全部收合">－</button>';
 document.body.prepend(bar);
 bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.atlasMode){setAtlasMode(b.dataset.atlasMode);parent.postMessage({type:'atlas-mode-route',slug,mode:b.dataset.atlasMode},location.origin);bar.querySelector('details')?.removeAttribute('open')}else if(b.hasAttribute('data-atlas-expand'))document.querySelectorAll('details:not(.atlas-menu)').forEach(d=>{if(!d.closest('[hidden]'))d.open=true});else if(b.hasAttribute('data-atlas-collapse'))document.querySelectorAll('details:not(.atlas-menu)').forEach(d=>d.open=false)});
 applyAtlasWishes();
}


function textAfterTerm(root,label){
 const term=[...root.querySelectorAll('dt')].find(dt=>dt.textContent.trim()===label);
 return term?.nextElementSibling?.tagName==='DD'?term.nextElementSibling:null;
}

const saintTaming={
 'saintsdragons:raevyx':{
  conditions:'先把成年野生殷雷龍壓到 60 HP 以下進入馴服眩暈。普通有效食物每次 20%；生羊肉 20%；生豬肉 20%；豐盛龍食 33.33%。失敗後要重新創造可餵食的眩暈窗口。Legacy Taming 預設關閉。'
 },
 'saintsdragons:ignivorus':{
  conditions:'先把成年野生噬焰龍壓到 100 HP 以下進入馴服眩暈。一般有效食物每次 14.29%；生牛肉 20%；生羊肉 14.29%；生豬肉 14.29%；豐盛龍食 25%。失敗會結束當次眩暈，需要再次壓制。Legacy Taming 預設關閉。'
 },
 'saintsdragons:atroxiia':{
  conditions:'先把成年野生凜蝮龍壓到 60 HP 以下進入馴服眩暈。一般有效食物每次 20%；豐盛龍食 33.33%。Legacy Taming 固定為關閉。',
  egg:true,
  hatch:'雌性凜蝮龍死亡時有 12% 機率掉落凜蝮龍蛋。把蛋放置後開始孵化；預設孵化時間 24,000 tick，也就是約 20 分鐘。孵化完成會生成凜蝮龍幼體。'
 },
 'saintsdragons:volitans':{
  conditions:'先把成年野生蓑鮋龍壓到 60 HP 以下進入馴服眩暈。一般有效食物每次 20%；豐盛龍食 30%。Legacy Taming 預設關閉。'
 },
 'saintsdragons:cindervane':{
  conditions:'燼翎龍不需要先打殘，直接餵食即可。一般有效食物每次 25%；生雞肉 33.33%；豐盛龍食 50%。失敗後等餵食冷卻結束再嘗試。'
 },
 'saintsdragons:varasuchus':{
  conditions:'目前預設 Legacy Taming 關閉：成年蜷鱷龍要主手空手、不要蹲下，右鍵騎上野生個體並完成騎乘馴服；餵食只會補血，不會直接馴服。只有伺服器把 Legacy Taming 打開時，食物馴服率才是一般食物 16.67%、生牛肉 16.67%、熱帶魚 25%。'
 },
 'saintsdragons:stegonaut':{
  conditions:'和平餵食馴服，不需要戰鬥壓制。一般有效食物與豐盛龍食的馴服率都為 100%，餵一次成功。'
 },
 'saintsdragons:nulljaw':{
  conditions:'使用歌萊果右鍵餵食；每次符合條件的餵食嘗試有 20% 機率成功。失敗後等餵食冷卻再繼續，不需要先打殘。'
 }
};
function enhanceSaintDragons(){
 for(const pet of document.querySelectorAll('.pet-card[data-pet-id^="saintsdragons:"]')){
  const id=pet.dataset.petId,name=pet.querySelector('h3')?.textContent.trim()||id,profile=saintTaming[id];
  if(!profile)continue;
  const source=[...document.querySelectorAll('.card[data-id]')].find(card=>card.dataset.id===id);
  const hp=(pet.querySelector('.entity-meta')?.textContent.match(/生命\s*([\d.]+)\s*HP/i)||[])[1];
  const mount=pet.querySelector('.mount-detail');
  if(mount){
   const healthTerms=[...mount.querySelectorAll('dt')].filter(dt=>dt.textContent.trim()==='生命值說明');
   healthTerms.forEach((dt,i)=>{const dd=dt.nextElementSibling;if(i===0&&dd?.tagName==='DD')dd.textContent=hp?'本包 Saints Dragons 0.9.51：'+name+'成年基礎生命值 '+hp+' HP。':'此條目沒有可核實的成年基礎生命值。';else{dd?.remove();dt.remove()}});
  }
  const acquire=[...pet.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent.includes('取得與材料'));
  if(!acquire)continue;
  const dl=acquire.querySelector('dl');
  const tame=textAfterTerm(acquire,'如何取得／馴服');
  const materials=textAfterTerm(acquire,'材料')?.textContent.trim();
  if(tame){
    const dt=tame.previousElementSibling;dt.textContent='馴服方法';
    tame.textContent=profile.conditions+(materials?' 可用材料：'+materials+'。':'');
  }
  for(const label of ['材料','在哪裡取得','重要條件／用途']){
    const dd=textAfterTerm(acquire,label);if(dd){dd.previousElementSibling?.remove();dd.remove();}
  }
  if(profile.egg&&source&&!acquire.dataset.eggAdded){
    const loot=textAfterTerm(source,'主要掉落池')?.textContent.trim()||'';
    if(loot.includes('龍蛋')){
      acquire.dataset.eggAdded='1';
      const eggDt=document.createElement('dt'),eggDd=document.createElement('dd'),hatchDt=document.createElement('dt'),hatchDd=document.createElement('dd');
      eggDt.textContent='龍蛋取得';eggDd.textContent=loot;
      hatchDt.textContent='孵化';hatchDd.textContent=profile.hatch;
      dl.append(eggDt,eggDd,hatchDt,hatchDd);
    }
  }
  pet.dataset.petSearch=pet.textContent.replace(/\s+/g,' ').trim()+' '+id;
 }
}
function installSpeedSorting(){
 const table=document.querySelector('#speed-overview .speed-table');if(!table||table.dataset.sortReady)return;
 const body=table.tBodies[0];if(!body)return;
 table.dataset.sortReady='1';
 [...body.rows].forEach((row,index)=>{row.dataset.originalOrder=String(index);for(let col=1;col<=4;col++){const text=row.cells[col]?.textContent||'',m=text.replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);row.dataset['sort'+col]=m?String(Number(m[0])):''}});
 const labels=['地面跑速','地面衝刺／加速','水平飛行','飛行加速'];let state=null;
 const rows=()=>[...body.querySelectorAll('tr[data-speed-id]')];
 const value=(row,col)=>{const raw=row.dataset['sort'+col];return raw===''||raw==null?null:Number(raw)};
 const render=()=>{
   const ordered=rows().sort((a,b)=>{
     if(!state)return Number(a.dataset.originalOrder)-Number(b.dataset.originalOrder);
     const av=value(a,state.col),bv=value(b,state.col);
     if(av==null&&bv==null)return Number(a.dataset.originalOrder)-Number(b.dataset.originalOrder);
     if(av==null)return 1;if(bv==null)return-1;
     const diff=state.dir==='desc'?bv-av:av-bv;
     return diff||Number(a.dataset.originalOrder)-Number(b.dataset.originalOrder);
   });
   body.replaceChildren(...ordered);
   table.querySelectorAll('.speed-sort-button').forEach(b=>{const active=!!state&&Number(b.dataset.col)===state.col;b.classList.toggle('active',active);b.setAttribute('aria-sort',active?(state.dir==='desc'?'descending':'ascending'):'none');b.querySelector('span').textContent=active?(state.dir==='desc'?'↓':'↑'):'↕'});
 };
 labels.forEach((label,i)=>{const col=i+1,th=table.tHead.rows[0].cells[col];if(!th)return;th.textContent='';const b=document.createElement('button');b.type='button';b.className='speed-sort-button';b.dataset.col=String(col);b.innerHTML=label+'<span aria-hidden="true">↕</span>';b.setAttribute('aria-label',label+'排序');b.onclick=e=>{e.preventDefault();e.stopPropagation();state=state?.col===col?{col,dir:state.dir==='desc'?'asc':'desc'}:{col,dir:'desc'};render()};th.append(b)});
 const tools=document.createElement('div');tools.className='speed-sort-tools';const clear=document.createElement('button');clear.type='button';clear.className='speed-sort-clear';clear.textContent='清除排序';clear.onclick=e=>{e.preventDefault();state=null;render()};tools.append(clear);table.closest('.table-scroll')?.before(tools);render();
}
function installModelZoom(){
 const attach=img=>{if(img.dataset.localZoom)return;img.dataset.localZoom='1';img.addEventListener('pointermove',e=>{if(e.pointerType&&e.pointerType!=='mouse')return;const r=img.getBoundingClientRect(),x=((e.clientX-r.left)/r.width)*100,y=((e.clientY-r.top)/r.height)*100;img.style.transformOrigin=x+'% '+y+'%';img.classList.add('local-zoom-active')});img.addEventListener('pointerleave',()=>img.classList.remove('local-zoom-active'))};
 document.querySelectorAll('.model-dialog img').forEach(attach);
 new MutationObserver(()=>document.querySelectorAll('.model-dialog img').forEach(attach)).observe(document.body,{childList:true,subtree:true});
}


function renameCollectedLabels(root=document){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];let n;
 while(n=walker.nextNode())if(n.nodeValue.includes('已收藏'))nodes.push(n);
 nodes.forEach(n=>n.nodeValue=n.nodeValue.replaceAll('已收藏','已取得'));
 for(const el of root.querySelectorAll?.('[aria-label],[title]')||[]){for(const attr of ['aria-label','title'])if(el.hasAttribute(attr)&&el.getAttribute(attr).includes('已收藏'))el.setAttribute(attr,el.getAttribute(attr).replaceAll('已收藏','已取得'))}
}
function polishEquipmentControls(){
 if(slug!=='equipment')return;
 for(const card of document.querySelectorAll('.card')){
   const wish=card.querySelector('.wishbtn'),done=card.querySelector('.collectbtn');
   if(!wish||!done)continue;
   card.classList.add('atlas-equipment-card');
   done.classList.add('atlas-done-icon');
   if(done.textContent!=='✓')done.textContent='✓';
   const aria=(done.classList.contains('selected')?'取消已取得：':'標記為已取得：')+(card.querySelector('.item-open h3')?.textContent.trim()||'裝備');
   if(done.getAttribute('aria-label')!==aria)done.setAttribute('aria-label',aria);
 }
 for(const b of document.querySelectorAll('#detail [data-done]')){const text=b.classList.contains('selected')?'✓ 已取得':'✓ 標記為已取得';if(b.textContent!==text)b.textContent=text;}
 renameCollectedLabels(document);
}
let polishTimer;
new MutationObserver(()=>{clearTimeout(polishTimer);polishTimer=setTimeout(()=>{renameCollectedLabels(document);polishEquipmentControls()},20)}).observe(document.body,{childList:true,subtree:true,characterData:true});
renameCollectedLabels(document);polishEquipmentControls();

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
  if(!atlasPopup)installAtlasQuickbar();
  for(const title of document.querySelectorAll('.modulehead h2')){
    const text=title.textContent.trim(),match=text.match(/^([^A-Za-z]+?)\s+([A-Za-z].*)$/);
    if(match){title.textContent='';const label=document.createElement('span'),alias=document.createElement('span');label.className='module-name';alias.className='module-alias';label.textContent=match[1];alias.textContent=match[2];title.append(label,alias);}
  }
  // Remove promotional reader introductions, preserving actual game instructions.
  document.querySelectorAll('header.masthead .mark,header.masthead p,header.hero > p:not([id]),header.hero .topline .brand,.collection-source-note').forEach(e=>e.remove());
  if(slug==='equipment')document.querySelector('header.hero h1').textContent='裝備收藏冊';
  if(slug==='scarlet')document.querySelector('header.masthead h1').textContent='緋紅獵人攻略';
  if(slug==='bosses'){
    if(atlasPopup){document.querySelector('header.hero')?.setAttribute('hidden','');document.querySelector('#boss-panel > .actions')?.setAttribute('hidden','');document.querySelector('#boss-panel > .controls')?.setAttribute('hidden','');document.querySelector('#taming-collection .pet-searchbar')?.setAttribute('hidden','');document.querySelector('#taming-collection > .actions')?.setAttribute('hidden','');document.querySelector('#pet-status')?.setAttribute('hidden','');document.querySelector('#speed-overview')?.setAttribute('hidden','');}
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
  if(slug==='bosses'){enhanceSaintDragons();installSpeedSorting();installModelZoom();}
  const topButton=document.createElement('button');
  topButton.id='atlas-back-top';topButton.type='button';topButton.hidden=true;
  topButton.dataset.itemHint='回到最上面';topButton.setAttribute('aria-label','回到最上面');
  topButton.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5h14M12 20V9M6 15l6-6 6 6"/></svg>';
  if(!atlasPopup)document.body.append(topButton);
  const updateTopButton=()=>{topButton.hidden=window.scrollY<280};
  if(!atlasPopup){addEventListener('scroll',updateTopButton,{passive:true});updateTopButton();}
  topButton.onclick=()=>window.scrollTo({top:0,behavior:document.documentElement.dataset.motion==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  const dock=slug==='equipment'?document.querySelector('.navigation'):null;
  if(dock)document.querySelector('.shell')?.prepend(dock);
  if(slug==='equipment')new MutationObserver(()=>{
    for(const p of document.querySelectorAll('.settingsblock p')){
      if(p.textContent.includes('收藏、目標與筆記會保存在目前的瀏覽器。'))p.textContent=p.textContent.replace('收藏、目標與筆記會保存在目前的瀏覽器。','登入後，收藏、目標與筆記會同步到你的帳號；訪客紀錄保存在目前瀏覽器。');
      if(p.textContent.startsWith('換手機、瀏覽器或移動檔案前'))p.textContent='登入帳號可在其他裝置接續紀錄。也可以先備份收藏，再用「還原收藏」匯入之前 HTML 匯出的進度。';
    }
  }).observe(find('detail'),{childList:true,subtree:true});
  addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='atlas-open'){atlasWishes=new Set(e.data.wishes||[]);setAtlasMode(e.data.mode||'all');applyAtlasWishes();openTarget(e.data)}});
  // Keep original recipes, descriptions, images, filters and export/import handlers intact.
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-id],[data-pet-id],.entry');
    if(!b)return;
    const id=b.dataset.id||b.dataset.petId||b.querySelector('[data-id]')?.dataset.id;
    if(id)parent.postMessage({type:'atlas-location',slug,id},location.origin);
  });
}
