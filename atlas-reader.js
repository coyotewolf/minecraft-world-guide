// Adapt the complete collection readers without flattening their source content.
const params=new URLSearchParams(location.search);
const slug=params.get('atlas');
const atlasPopup=params.get('popup')==='1'||params.has('bossPopup');
if(atlasPopup)document.documentElement.dataset.atlasPopup='true';
function applyWorldTheme(theme){
 const next=theme==='light'?'light':'dark';
 document.documentElement.dataset.worldTheme=next;
}
try{applyWorldTheme(parent.document.documentElement.dataset.theme||localStorage.getItem('iaa-theme')||'dark')}catch{applyWorldTheme(localStorage.getItem('iaa-theme')||'dark')}
addEventListener('message',e=>{
 if(e.origin===location.origin&&e.source===parent&&e.data?.type==='guide-theme')applyWorldTheme(e.data.theme);
});
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
 queueMicrotask(()=>{unifyReaderStateControls();updateAtlasModeEmpty()});
}
function atlasCompleted(row){
 return !!row.querySelector('input[data-field="loot"]:checked,input[data-pet-field="tamed"]:checked');
}
function setAtlasMode(mode){
 atlasMode=['all','wish','done','materials'].includes(mode)?mode:'all';
 document.querySelectorAll('[data-atlas-mode]').forEach(b=>b.classList.toggle('active',b.dataset.atlasMode===atlasMode));
 if(slug==='equipment'){
  const map={all:'all',wish:'wish',done:'done',materials:'materials'};document.querySelector('[data-tab="'+map[atlasMode]+'"]')?.click();return;
 }
 if(slug==='skills'){
  if(mode==='done')input('state','done');else if(mode==='all')input('state','');
 }else if(slug==='bosses'){
  input('state','');input('pet-state','');
 }
 for(const row of atlasRows()){
  row.hidden=mode==='wish'?!atlasWishes.has(atlasEntryId(row)):mode==='done'?!atlasCompleted(row):false;
 }
 applyAtlasWishes();updateAtlasModeEmpty();
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
 const modeButtons=slug==='scarlet'?'':'<button type="button" data-atlas-mode="all">圖鑑</button><button type="button" data-atlas-mode="wish">☆ 想收集</button><button type="button" data-atlas-mode="done">✓ 已取得</button>'+(slug==='equipment'?'<button type="button" data-atlas-mode="materials">素材</button>':'');
 const menu=slug==='scarlet'?'':'<details class="atlas-menu"><summary aria-label="收藏冊選單">☰</summary><div class="atlas-menu-panel">'+modeButtons+'</div></details>';
 const desktopModes=slug==='scarlet'?'':'<nav class="atlas-desktop-modes" aria-label="收藏冊檢視">'+modeButtons+'</nav>';
 bar.innerHTML=menu+'<strong class="atlas-quick-title">'+atlasTitle()+'</strong>'+desktopModes+'<span class="atlas-quick-spacer"></span><button type="button" data-atlas-expand aria-label="全部展開">＋</button><button type="button" data-atlas-collapse aria-label="全部收合">－</button>';
 document.body.prepend(bar);
 bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.atlasMode){setAtlasMode(b.dataset.atlasMode);parent.postMessage({type:'atlas-mode-route',slug,mode:b.dataset.atlasMode},location.origin);bar.querySelector('details')?.removeAttribute('open')}else if(b.hasAttribute('data-atlas-expand'))document.querySelectorAll('details:not(.atlas-menu)').forEach(d=>{if(!d.closest('[hidden]'))d.open=true});else if(b.hasAttribute('data-atlas-collapse'))document.querySelectorAll('details:not(.atlas-menu)').forEach(d=>d.open=false)});
 document.addEventListener('pointerdown',e=>{const menu=bar.querySelector('.atlas-menu[open]');if(menu&&!menu.contains(e.target))menu.removeAttribute('open')});
 applyAtlasWishes();
}


function textAfterTerm(root,label){
 const term=[...root.querySelectorAll('dt')].find(dt=>dt.textContent.trim()===label);
 return term?.nextElementSibling?.tagName==='DD'?term.nextElementSibling:null;
}

function pairFilterActions(box,done,reset){
 const row=document.createElement('div');row.className='atlas-filter-actions';
 if(reset){reset.textContent='清除';reset.before(row);row.append(reset,done)}else{row.append(done);box.append(row)}
}
function normalizeEquipmentSearchDock(){
 if(slug!=='equipment')return;

 // Remove source-only top chrome. The shared atlas quickbar is the only collection header.
 document.querySelector('header.hero')?.setAttribute('hidden','');

 // Remove only the source collection tabs (圖鑑 / 想收集 / 素材 / 已取得).
 // Do NOT remove the equipment browsing modes (依照模組 / 依照系列 / 全部裝備).
 const sourceTabs=[...document.querySelectorAll('[data-tab]')].filter(el=>!el.closest('#atlas-quickbar'));
 sourceTabs.forEach(el=>el.setAttribute('hidden',''));
 for(const parent of new Set(sourceTabs.map(el=>el.parentElement).filter(Boolean))){
  const visibleChildren=[...parent.children].filter(el=>!el.hasAttribute('hidden'));
  if(!visibleChildren.length)parent.setAttribute('hidden','');
 }

 const search=document.getElementById('search')||document.querySelector('input[type="search"],input[placeholder*="搜尋"]');
 const filters=document.getElementById('filters');
 const oldToggle=document.getElementById('toggleFilters')||[...document.querySelectorAll('button')].find(b=>/篩選/.test(b.textContent.trim())&&!b.closest('#atlas-quickbar'));
 if(!search)return;

 let controls=document.querySelector('.atlas-equipment-controls');
 if(!controls){
  const oldAnchor=search.closest('.searchbar,.controls,.toolbar,.filters,.navigation')||search.parentElement;
  controls=document.createElement('div');
  controls.className='controls atlas-equipment-controls';

  const searchbar=document.createElement('div');
  searchbar.className='searchbar';

  const drawer=document.createElement('details');
  drawer.className='filter-drawer atlas-equipment-filter-drawer';
  const summary=document.createElement('summary');
  summary.textContent='篩選';
  drawer.append(summary);

  oldAnchor.parentElement?.insertBefore(controls,oldAnchor);
  searchbar.append(search,drawer);
  controls.append(searchbar);

  if(filters){
   filters.removeAttribute('hidden');
   drawer.append(filters);
  }

  if(oldToggle&&oldToggle!==summary)oldToggle.setAttribute('hidden','');
  if(oldAnchor!==controls&&oldAnchor!==document.body){
   // Leave source containers in place only when they still contain meaningful controls.
   const meaningful=[...oldAnchor.children].filter(el=>el!==search&&!el.hasAttribute('hidden'));
   if(!meaningful.length)oldAnchor.setAttribute('hidden','');
  }
 }else{
  const drawer=controls.querySelector('.atlas-equipment-filter-drawer');
  if(filters&&drawer&&filters.parentElement!==drawer){
   filters.removeAttribute('hidden');
   drawer.append(filters);
  }
 }

 // Restore and preserve the three equipment browsing buttons no matter which source wrapper owns them.
 let modeButtons=[...document.querySelectorAll('button')].filter(b=>/^(依照模組|依照系列|全部裝備)$/.test(b.textContent.trim()));
 if(!modeButtons.length){
  modeButtons=[...document.querySelectorAll('[data-view]')].filter(b=>!b.closest('#atlas-quickbar')&&/mod|module|series|family|all/i.test(b.dataset.view||''));
 }
 if(modeButtons.length){
  let modes=document.querySelector('.atlas-equipment-viewmodes');
  if(!modes){
   modes=document.createElement('div');
   modes.className='atlas-equipment-viewmodes';
   controls.after(modes);
  }
  for(const b of modeButtons){
   b.removeAttribute('hidden');
   b.parentElement?.removeAttribute('hidden');
   if(b.parentElement!==modes)modes.append(b);
  }
 }

 // If a source navigation wrapper remains after extracting the useful mode buttons, hide it.
 for(const nav of document.querySelectorAll('.navigation,.viewmodes')){
  if(nav.classList.contains('atlas-equipment-viewmodes'))continue;
  const useful=[...nav.querySelectorAll('button')].filter(b=>/^(依照模組|依照系列|全部裝備)$/.test(b.textContent.trim()));
  if(!useful.length)nav.setAttribute('hidden','');
 }
}

function installFilterCompletion(){
 const install=(box,close)=>{
  if(!box||box.querySelector('.atlas-filter-done'))return;
  const reset=[...box.querySelectorAll('button')].find(b=>/清除|重設/.test(b.textContent.trim()));
  if(reset)reset.textContent='清除';
  const done=document.createElement('button');done.type='button';done.className='atlas-filter-done';done.textContent='完成';done.onclick=close;
  pairFilterActions(box,done,reset);
 };
 for(const d of document.querySelectorAll('.filter-drawer')){
  install(d.querySelector('.filter-options,.filters,.pet-controls'),()=>d.removeAttribute('open'));
 }
 for(const reset of document.querySelectorAll('#boss-reset,#pet-reset,#reset')){
  const box=reset.closest('.filter-options,.filters,.pet-controls,#filters,.controls');if(!box)continue;
  const drawer=reset.closest('details');
  install(box,()=>{if(drawer)drawer.removeAttribute('open');else{const toggle=document.getElementById('toggleFilters');if(box.id==='filters'){box.hidden=true;toggle?.setAttribute('aria-expanded','false')}}});
 }
 const filters=document.getElementById('filters'),toggle=document.getElementById('toggleFilters');
 if(filters&&toggle)install(filters,()=>{filters.hidden=true;toggle.setAttribute('aria-expanded','false')});
 for(const b of document.querySelectorAll('button'))if(/^(清除(?:／重設)?|清除篩選|重設篩選|重設)$/.test(b.textContent.trim()))b.textContent='清除';
}
function removeAtlasUtilityButtons(){
 for(const id of ['export','import','csv','pet-export','pet-import'])document.getElementById(id)?.remove();
 for(const b of document.querySelectorAll('button')){
  const label=b.textContent.trim();
  if(/^(匯出|匯入)/.test(label)||/CSV/i.test(label)||/^(展開本頁|收合本頁)$/.test(label))b.remove();
 }
}
function updateAtlasModeEmpty(){
 document.querySelector('.atlas-mode-empty')?.remove();
 if(!['wish','done'].includes(atlasMode))return;
 let visible=[];
 if(slug==='equipment'){
  visible=[...document.querySelectorAll('.card')].filter(card=>!card.hidden&&getComputedStyle(card).display!=='none');
 }else visible=atlasRows().filter(r=>!r.hidden);
 if(visible.length)return;
 // Source readers may already expose their own generic "no matches" panel.
 // Hide it in wishlist/obtained modes so the user sees exactly one state-specific explanation.
 document.querySelectorAll('.empty,#empty,#pet-empty,.empty-state').forEach(e=>{if(!e.classList.contains('atlas-mode-empty'))e.hidden=true});
 const box=document.createElement('div');box.className='empty atlas-mode-empty';
 box.textContent=atlasMode==='wish'?'目前沒有「想收集」項目。打開任一條目，點 ☆ 星號即可加入「我想收集」。':'目前沒有「已取得」項目。取得後點條目上的 ✓ 按鈕，即會出現在這裡。';
 (document.querySelector('#list')||document.querySelector('#taming-collection .grid')||document.querySelector('#boss-panel .grid')||document.querySelector('.content')||document.querySelector('main'))?.append(box);
}

const saintTaming={
 'saintsdragons:raevyx':{
  conditions:'先把成年野生殷雷龍壓到 60 HP 以下進入馴服眩暈。普通有效食物每次 20%；生羊肉 20%；生豬肉 20%；豐盛龍食 33.33%。失敗後要重新創造可餵食的眩暈窗口。Legacy Taming 預設關閉。',
  egg:'雌性殷雷龍死亡時有 12% 機率掉落殷雷龍蛋；另外，已馴服、進入繁殖狀態且異性的同種成龍成功繁殖時，雌性會在附近產下殷雷龍蛋。'
 },
 'saintsdragons:ignivorus':{
  conditions:'先把成年野生噬焰龍壓到 100 HP 以下進入馴服眩暈。一般有效食物每次 14.29%；生牛肉 20%；生羊肉 14.29%；生豬肉 14.29%；豐盛龍食 25%。失敗會結束當次眩暈，需要再次壓制。Legacy Taming 預設關閉。',
  egg:'雌性噬焰龍死亡時有 12% 機率掉落噬焰龍蛋；另外，已馴服、進入繁殖狀態且異性的同種成龍成功繁殖時，雌性會在附近產下噬焰龍蛋。'
 },
 'saintsdragons:atroxiia':{
  conditions:'先把成年野生凜蝮龍壓到 60 HP 以下進入馴服眩暈。一般有效食物每次 20%；豐盛龍食 33.33%。Legacy Taming 固定為關閉。',
  egg:'雌性凜蝮龍死亡時有 12% 機率掉落凜蝮龍蛋；另外，已馴服、進入繁殖狀態且異性的同種成龍成功繁殖時，雌性會在附近產下凜蝮龍蛋。',
  hatch:'把凜蝮龍蛋放置後開始孵化；預設孵化時間 24,000 tick，也就是約 20 分鐘。孵化完成會生成凜蝮龍幼體。'
 },
 'saintsdragons:volitans':{
  conditions:'先把成年野生蓑鮋龍壓到 60 HP 以下進入馴服眩暈。一般有效食物每次 20%；豐盛龍食 30%。Legacy Taming 預設關閉。',
  egg:'雌性蓑鮋龍死亡時有 12% 機率掉落蓑鮋龍蛋；另外，已馴服、進入繁殖狀態且異性的同種成龍成功繁殖時，雌性會在附近產下蓑鮋龍蛋。',
  hatch:'把蓑鮋龍蛋放在水中或可含水位置孵化；預設孵化時間 18,000 tick，也就是約 15 分鐘。'
 },
 'saintsdragons:cindervane':{
  conditions:'燼翎龍不需要先打殘，直接餵食即可。一般有效食物每次 25%；生雞肉 33.33%；豐盛龍食 50%。失敗後等餵食冷卻結束再嘗試。',
  egg:'雌性燼翎龍死亡時有 12% 機率掉落燼翎龍蛋；另外，已馴服、進入繁殖狀態且異性的同種成龍成功繁殖時，雌性會在附近產下燼翎龍蛋。'
 },
 'saintsdragons:varasuchus':{
  conditions:'目前預設 Legacy Taming 關閉：成年蜷鱷龍要主手空手、不要蹲下，右鍵騎上野生個體並完成騎乘馴服；餵食只會補血，不會直接馴服。只有伺服器把 Legacy Taming 打開時，食物馴服率才是一般食物 16.67%、生牛肉 16.67%、熱帶魚 25%。',
  egg:'雌性蜷鱷龍死亡時有 12% 機率掉落蜷鱷龍蛋；另外，已馴服、進入繁殖狀態且異性的同種成龍成功繁殖時，雌性會在附近產下蜷鱷龍蛋。'
 },
 'saintsdragons:stegonaut':{
  conditions:'和平餵食馴服，不需要戰鬥壓制。一般有效食物與豐盛龍食的馴服率都為 100%，餵一次成功。',
  egg:'雌性堅甲龍死亡時有 12% 機率掉落堅甲龍蛋；另外，已馴服、進入繁殖狀態且異性的同種成龍成功繁殖時，雌性會在附近產下堅甲龍蛋。'
 },
 'saintsdragons:nulljaw':{
  conditions:'使用歌萊果右鍵餵食；每次符合條件的餵食嘗試有 20% 機率成功。失敗後等餵食冷卻再繼續，不需要先打殘。'
 }
};
const saintSpawn={
 'saintsdragons:raevyx':'主世界・草甸、風襲丘陵、櫻花樹林、風襲森林、雪林、雪原、莽原高地等指定生態域；0.9.51 預設自訂生成只在雷暴且可見天空時出現。',
 'saintsdragons:stegonaut':'主世界・繁茂洞穴；0.9.51 預設自訂生成只在地下、不可見天空的位置出現。',
 'saintsdragons:cindervane':'主世界・山地／丘陵／惡地／沙漠類生態域；原版明確包含裸岩山峰、尖峭山峰、冰封山峰、雪林、櫻花樹林、草甸與沙漠。',
 'saintsdragons:atroxiia':'主世界・寒冷生態域；原版明確包含雪原與冰刺之地。',
 'saintsdragons:volitans':'主世界・海洋類生態域水下；涵蓋所有原版海洋變體，0.9.51 預設自訂生成要求至少 3 格連續水柱。',
 'saintsdragons:nulljaw':'終界・終界荒地。',
 'saintsdragons:ignivorus':'主世界・噬焰龍巢穴；生成生態域包含荒地／火山類，以及平原、莽原、草甸、風襲丘陵、風襲礫質丘陵、風襲森林與沙漠等指定生態域。',
 'saintsdragons:varasuchus':'主世界・蜷鱷龍巢穴；海灘／沼澤類生態域，原版明確包含海灘、石岸、沼澤與紅樹林沼澤。',
 'saintsdragons:ivy_oleander':'主世界・常春藤小屋；森林類生態域，原版明確包含森林、樺木森林、原始樺木森林、黑森林、繁花森林、針葉林、原始松木針葉林、原始雲杉針葉林與雪地針葉林。'
};
const berkTaming={
 'dragonsofberk:night_fury':{food:'生鮭魚、生鱈魚、熱帶魚',feeds:25,breed:'蜂巢',hatch:1200,gate:'接近第一階段時，玩家需具備夜視效果，且不能持武器、不能穿護甲；否則 後續馴服階段會把不符合條件的玩家視為威脅。',fury:true},
 'dragonsofberk:light_fury':{food:'生鮭魚、生鱈魚、熱帶魚',feeds:25,breed:'蜂巢',hatch:1200,gate:'接近第一階段時，玩家需具備隱形效果，且不能持武器、不能穿護甲；否則 後續馴服階段會把不符合條件的玩家視為威脅。',fury:true},
 'dragonsofberk:night_light':{food:'生鮭魚、生鱈魚、熱帶魚',feeds:25,breed:'蜂巢',hatch:1200,gate:'接近第一階段時，玩家需具備隱形效果，且不能持武器、不能穿護甲；否則 後續馴服階段會把不符合條件的玩家視為威脅。',fury:true,noWild:true},
 'dragonsofberk:monstrous_nightmare':{food:'生羊肉、生豬肉',feeds:25,breed:'可疑的燉湯',hatch:2400,gate:'接近第一階段時，玩家需具備抗火效果，且不能持武器、不能穿護甲；否則 後續馴服階段會把不符合條件的玩家視為威脅。'},
 'dragonsofberk:deadly_nadder':{food:'生雞肉',feeds:12,breed:'可疑的燉湯',hatch:600,gate:'第一階段在 8 格內接近時不要持武器；後續馴服階段會把持武器或先前已被視為威脅的玩家繼續當成威脅。'},
 'dragonsofberk:gronckle':{food:'生牛肉',feeds:12,breed:'可疑的燉湯',hatch:600,gate:'第一階段在 8 格內接近時不要持武器；後續馴服階段會把持武器或先前已被視為威脅的玩家繼續當成威脅。'},
 'dragonsofberk:zippleback':{food:'生鮭魚、生鱈魚、熱帶魚',feeds:25,breed:'可疑的燉湯',hatch:2400,gate:'接近第一階段時，玩家需具備力量效果，且不能持武器、不能穿護甲；否則 後續馴服階段會把不符合條件的玩家視為威脅。'},
 'dragonsofberk:skrill':{food:'生鮭魚、生鱈魚、熱帶魚',feeds:18,breed:'可疑的燉湯',hatch:1200},
 'dragonsofberk:stinger':{food:'生羊肉',feeds:12,breed:'可疑的燉湯',hatch:1200,gate:'第一階段在 8 格內接近時不要持武器；後續馴服階段會把持武器或先前已被視為威脅的玩家繼續當成威脅。'},
 'dragonsofberk:terrible_terror':{food:'生鮭魚、生鱈魚、熱帶魚',feeds:12,breed:'河豚',hatch:300,gate:'第一階段在 8 格內接近時不要持武器；後續馴服階段會把持武器或先前已被視為威脅的玩家繼續當成威脅。'},
 'dragonsofberk:triple_stryke':{food:'生牛肉',feeds:18,breed:'可疑的燉湯',hatch:1200},
 'dragonsofberk:speed_stinger':{food:'生兔肉',feeds:25,breed:'可疑的燉湯',hatch:300,cold:true},
 'dragonsofberk:speed_stinger_leader':{untameable:true}
};
function berkTameText(p){
 if(p.untameable)return '此實體在 1.0.5 程式碼中明確拒絕所有馴服食物（isItemStackForTaming 永遠回傳 false），不能像一般疾刺龍直接馴服。';
 const gate=p.gate?' '+p.gate:'';
 return '第一階段使用 '+p.food+' 推進馴服條。基礎需要 '+p.feeds+' 次有效餵食；皮膚／變體越稀有會再增加 0–5 次（權重 ≥75：+0、35–74：+2、15–34：+3、4–14：+4、1–3：+5）。'+gate+' 第一階段完成後還要進行騎乘馴服：騎上野生龍反覆嘗試，每次判定有 30% 成功率；失敗時會被甩下，龍也會發怒，等安全後再重試。';
}
function berkFuryBreedText(id){
 if(id==='dragonsofberk:night_fury')return '把兩隻已馴服、成年且符合配對條件的龍帶到蜂巢附近，用蜂巢啟動繁殖。夜煞不能和另一隻純夜煞配對，可與光煞或夜光龍配對。夜煞×光煞、夜煞×夜光龍：每次有 3% 產光煞蛋、96% 產夜光龍蛋；另有 1% 的稀有結果，只有兩隻親代各自累積的稀有後代次數都少於 10 次時才會產夜煞蛋，達到門檻後這 1% 也改為夜光龍蛋。';
 if(id==='dragonsofberk:light_fury')return '把兩隻已馴服、成年且符合配對條件的龍帶到蜂巢附近，用蜂巢啟動繁殖。光煞可與夜煞、光煞或夜光龍配對。光煞×光煞會產光煞蛋；光煞×夜煞時為 3% 光煞、96% 夜光龍，另有 1% 稀有夜煞結果，但只有兩隻親代各自累積的稀有後代次數都少於 10 次時才成立，達到門檻後這 1% 也改成夜光龍。光煞×夜光龍時，稀有判定尚未達門檻才可能產光煞，其餘產夜光龍。';
 if(id==='dragonsofberk:night_light')return '把兩隻已馴服、成年且符合配對條件的龍帶到蜂巢附近，用蜂巢啟動繁殖。夜光龍不在自然生成表中，主要靠夜煞、光煞與夜光龍之間的繁殖取得。夜光龍×夜光龍會產夜光龍蛋；與夜煞或光煞配對時，蛋種依上述稀有繁殖規則決定，其中夜煞×夜光龍和夜煞×光煞使用相同機率。';
 return '';
}
function berkBreedText(id,p){
 if(!p||p.untameable||!p.breed)return '';
 if(p.fury)return berkFuryBreedText(id);
 return '準備兩隻已馴服、成年且符合配對條件的同種異性龍，對牠們使用 '+p.breed+' 讓雙方進入繁殖狀態；成功配對後會產下這個物種的龍蛋。';
}
function berkHatchText(p){
 if(!p||!p.hatch)return '';
 const mins=Math.round(p.hatch/60*100)/100;
 return '龍蛋的 1.0.5 預設孵化時間為 '+p.hatch+' 秒（約 '+mins+' 分鐘，可由伺服器設定調整）。'+(p.cold?'疾刺龍蛋需要低溫孵化。':'依該物種龍蛋的正常孵化條件放置即可。')+'孵化出的幼龍仍應儘快完成馴服。';
}

const berkSpawn={
 'dragonsofberk:stinger':'主世界自然生成：向日葵平原、莽原、莽原高地（預設權重 5，每群 2–3）；惡地、疏林惡地、風蝕惡地（權重 1，每群 1–2）。',
 'dragonsofberk:terrible_terror':'主世界自然生成：石岸、河流、海灘（預設權重 1，每群 1–3）；叢林、竹林、黑森林（權重 2，每群 2–3）。',
 'dragonsofberk:deadly_nadder':'主世界自然生成：雪原、草甸（權重 1，每群 2–3）；風襲丘陵、風襲礫質丘陵、風襲森林（權重 2，每群 2–3）；稀疏叢林、莽原、莽原高地（權重 3，每群 2–3）；雪林、森林、繁花森林、樺木森林、原始樺木森林、風襲莽原（權重 4，每群 1–3）。',
 'dragonsofberk:gronckle':'主世界自然生成：雪原、沼澤、草甸（權重 1，每群 1–2）；原始樺木森林、莽原高地、風襲莽原（權重 2，每群 2–3）；平原、雪林、向日葵平原、莽原（權重 3，每群 1–2）。',
 'dragonsofberk:zippleback':'主世界自然生成：稀疏叢林（權重 3，每群 2–3）；冰刺之地、雪原、沼澤（權重 1，每群 1–2）。',
 'dragonsofberk:light_fury':'主世界自然生成：雪原、雪坡、雪地針葉林、雪林、冰封山峰、尖峭山峰、冰刺之地（權重 1，每群 1）。',
 'dragonsofberk:night_fury':'終界自然生成：終界、終界高地、終界中型島嶼（權重 1，每群 1）。',
 'dragonsofberk:monstrous_nightmare':'主世界自然生成：惡地、疏林惡地、風蝕惡地，以及風襲丘陵、風襲礫質丘陵、風襲森林（各組權重 1，每群 1–2）。',
 'dragonsofberk:skrill':'主世界自然生成：雪坡、尖峭山峰、冰封山峰、裸岩山峰（權重 2，每群 1–2）。',
 'dragonsofberk:triple_stryke':'主世界自然生成：疏林惡地、惡地（權重 1，每群 1–2）；雪地針葉林、針葉林、原始松木針葉林、原始雲杉針葉林（權重 2，每群 1–3）。',
 'dragonsofberk:speed_stinger':'主世界疾刺龍巢穴：石峰／尖峭山峰／草甸的洞穴巢、深海冰洋／冰封海洋／冰刺之地／雪原的冰巢、叢林／稀疏叢林／竹林的叢林巢、針葉林／原始松木針葉林／原始雲杉針葉林的針葉林巢。四種結構預設 spacing 25、separation 8；結構生成覆寫每群 1–4 隻疾刺龍。',
 'dragonsofberk:speed_stinger_leader':'主世界疾刺龍四種巢穴結構內：洞穴巢（石峰、尖峭山峰、草甸）、冰巢（深海冰洋、冰封海洋、冰刺之地、雪原）、叢林巢（叢林、稀疏叢林、竹林）、針葉林巢（針葉林、原始松木針葉林、原始雲杉針葉林）。巢穴 NBT 明確放置疾刺龍領袖；結構預設 spacing 25、separation 8。'
};
function enhanceBerkDragons(){
 for(const pet of document.querySelectorAll('.pet-card[data-pet-id^="dragonsofberk:"]')){
  const id=pet.dataset.petId,spawn=berkSpawn[id]||'',profile=berkTaming[id];
  const acquire=[...pet.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent.includes('取得與材料'));if(!acquire)continue;
  const dl=acquire.querySelector('dl');
  const tame=textAfterTerm(acquire,'如何取得／馴服')||textAfterTerm(acquire,'馴服進度')||textAfterTerm(acquire,'馴服方法');
  if(tame&&profile){tame.previousElementSibling.textContent='馴服方法';tame.textContent=berkTameText(profile)}
  const where=textAfterTerm(acquire,'在哪裡取得');
  if(where){
    if(spawn){where.previousElementSibling.textContent='野生個體';where.textContent='⌖ '+spawn;}
    else if(/物種巢穴|生成設定|龍蛋路線|自然生成/.test(where.textContent)){where.previousElementSibling?.remove();where.remove();}
  }else if(spawn&&dl){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='野生個體';dd.textContent='⌖ '+spawn;dl.prepend(dt,dd)}
  for(const dd of [...acquire.querySelectorAll('dd')])if(/物種巢穴／生成設定|亦有對應龍蛋路線|依物種設定|一般與豐盛|機率由物種/.test(dd.textContent)){dd.previousElementSibling?.remove();dd.remove()}
  if(profile&&dl&&!acquire.dataset.berkExact){
    acquire.dataset.berkExact='1';
    const breed=berkBreedText(id,profile);if(breed){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='繁殖／龍蛋取得';dd.textContent=breed;dl.append(dt,dd)}
    const hatch=berkHatchText(profile);if(hatch){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='孵化';dd.textContent=hatch;dl.append(dt,dd)}
  }
  pet.dataset.petSearch=pet.textContent.replace(/\s+/g,' ').trim()+' '+id;
 }
 for(const card of document.querySelectorAll('.card[data-id^="dragonsofberk:"]')){
  const id=card.dataset.id,spawn=berkSpawn[id]||'',profile=berkTaming[id],loc=card.querySelector('.loc');
  if(spawn&&loc)loc.textContent='⌖ '+spawn;
  if(profile)card.dataset.search=(card.dataset.search||card.textContent.replace(/\s+/g,' ').trim())+' '+berkTameText(profile)+' '+berkBreedText(id,profile)+' '+berkHatchText(profile);
 }
}
function enhanceSaintDragons(){
 for(const pet of document.querySelectorAll('.pet-card[data-pet-id^="saintsdragons:"]')){
  const id=pet.dataset.petId,name=pet.querySelector('h3')?.textContent.trim()||id,profile=saintTaming[id];
  if(!profile)continue;
  const source=[...document.querySelectorAll('.card[data-id]')].find(card=>card.dataset.id===id);
  const spawn=saintSpawn[id]||'';
  if(source){
    const loc=source.querySelector('.loc');if(loc&&spawn)loc.textContent='⌖ '+spawn;if(loc&&!spawn&&/此版有野生|依物種生成設定|野生／孵化個體/.test(loc.textContent))loc.remove();
    if(profile.egg){const loot=textAfterTerm(source,'主要掉落池');if(loot&&!loot.textContent.includes('龍蛋'))loot.textContent=loot.textContent.replace(/[。；\s]*$/,'')+'；'+profile.egg.split('；')[0];}
    source.dataset.search=source.textContent.replace(/\s+/g,' ').trim()+' '+id;
  }
  const hp=(pet.querySelector('.entity-meta')?.textContent.match(/生命\s*([\d.]+)\s*HP/i)||[])[1];
  const mount=pet.querySelector('.mount-detail');
  if(mount){
   const healthTerms=[...mount.querySelectorAll('dt')].filter(dt=>dt.textContent.trim()==='生命值說明');
   healthTerms.forEach((dt,i)=>{const dd=dt.nextElementSibling;if(i===0&&dd?.tagName==='DD'){if(hp)dd.textContent='成年基礎生命值 '+hp+' HP。';else{dd.remove();dt.remove();}}else{dd?.remove();dt.remove()}});
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
  const where=textAfterTerm(acquire,'在哪裡取得');
  if(where){if(spawn){where.previousElementSibling.textContent='野生個體';where.textContent='⌖ '+spawn;}else{where.previousElementSibling?.remove();where.remove();}}
  else if(spawn&&dl){const wildDt=document.createElement('dt'),wildDd=document.createElement('dd');wildDt.textContent='野生個體';wildDd.textContent='⌖ '+spawn;dl.prepend(wildDt,wildDd);}
  for(const label of ['材料','重要條件／用途']){const dd=textAfterTerm(acquire,label);if(dd){dd.previousElementSibling?.remove();dd.remove();}}
  if(profile.egg&&dl&&!acquire.dataset.eggAdded){
    acquire.dataset.eggAdded='1';
    const eggDt=document.createElement('dt'),eggDd=document.createElement('dd');eggDt.textContent='龍蛋取得';eggDd.textContent=profile.egg;dl.append(eggDt,eggDd);
    if(profile.hatch){const hatchDt=document.createElement('dt'),hatchDd=document.createElement('dd');hatchDt.textContent='孵化';hatchDd.textContent=profile.hatch;dl.append(hatchDt,hatchDd);}
  }
  pet.dataset.petSearch=pet.textContent.replace(/\s+/g,' ').trim()+' '+id;
 }
 document.querySelectorAll('.loc').forEach(loc=>{if(/此版有野生|依物種生成設定|野生／孵化個體/.test(loc.textContent))loc.remove()});
}

function polishPlayerFacingDetails(){
 if(slug!=='bosses')return;
 for(const card of document.querySelectorAll('.card[data-id],.pet-card[data-pet-id]')){
  const meta=card.querySelector('.entity-meta')?.textContent||'';
  const hp=(meta.match(/生命\s*([\d,.]+)\s*HP/)||[])[1];
  for(const dt of [...card.querySelectorAll('dt')]){
   if(dt.textContent.trim()!=='生命值說明')continue;
   const dd=dt.nextElementSibling;if(!dd||dd.tagName!=='DD')continue;
   if(hp)dd.textContent=`生命：${hp} HP`;
  }
  for(const dl of card.querySelectorAll('dl')){
   const seen=new Set();
   for(const dt of [...dl.querySelectorAll('dt')]){
    const dd=dt.nextElementSibling;if(dd?.tagName!=='DD')continue;
    const key=dt.textContent.trim()+'\n'+dd.textContent.trim();
    if(seen.has(key)){dt.remove();dd.remove()}else seen.add(key);
   }
  }
  if(card.dataset.petId)card.dataset.petSearch=card.textContent.replace(/\s+/g,' ').trim()+' '+card.dataset.petId;
  else if(card.dataset.id)card.dataset.search=card.textContent.replace(/\s+/g,' ').trim()+' '+card.dataset.id;
 }
}
function installScarletChapterScroll(){
 if(slug!=='scarlet')return;
 const sidebar=document.querySelector('.sidebar');if(!sidebar||sidebar.dataset.chapterWheel)return;
 sidebar.dataset.chapterWheel='1';
 sidebar.addEventListener('wheel',e=>{
  if(matchMedia('(max-width:760px)').matches)return;
  e.preventDefault();e.stopPropagation();
  sidebar.scrollTop+=e.deltaY;
 },{passive:false});
}
function polishScarletGuide(){
 if(slug!=='scarlet')return;
 document.querySelectorAll('figure').forEach(f=>f.classList.add('theme-diagram'));
 const classify=el=>{
  if(el.closest('.guide-inline-item,[data-inventory-item]')){el.classList.remove('scarlet-theme-visual');el.classList.add('scarlet-item-visual');return}
  const attrW=Number(el.getAttribute('width')||0),attrH=Number(el.getAttribute('height')||0);
  const small=el.tagName==='IMG'&&(el.closest('table,.item,.icon,.skill-icon,.weapon-icon,.armor-icon')||((attrW&&attrW<=96)||(attrH&&attrH<=96))||(el.complete&&el.naturalWidth&&el.naturalWidth<=96&&el.naturalHeight<=96));
  if(small){el.classList.remove('scarlet-theme-visual');el.classList.add('scarlet-item-visual');return}
  el.classList.add('scarlet-theme-visual');el.classList.remove('scarlet-item-visual');
 };
 document.querySelectorAll('main img,main svg,.content img,.content svg,.chapter img,.chapter svg').forEach(el=>{
  classify(el);
  if(el.tagName==='IMG'&&!el.complete)el.addEventListener('load',()=>classify(el),{once:true});
 });
 document.querySelectorAll('.chapter-progress,.reading-progress,[data-progress],progress').forEach(e=>e.remove());
}

function unifyBossCollectionChecks(){
 for(const card of document.querySelectorAll('.card[data-id],.pet-card[data-pet-id]')){
  const checks=card.querySelector('.checks');if(!checks)continue;
  const input=card.dataset.petId?checks.querySelector('input[data-pet-field="tamed"]'):checks.querySelector('input[data-field="loot"]');
  if(!input){checks.remove();continue;}
  const label=document.createElement('label');label.className='atlas-single-collect';
  const updateLabel=()=>{label.title=input.checked?'取消已取得':'標記為已取得';label.setAttribute('aria-label',label.title)};
  updateLabel();input.addEventListener('change',()=>{updateLabel();if(atlasMode==='done')card.hidden=!input.checked});
  checks.replaceChildren(label);label.append(input,document.createTextNode('✓'));checks.classList.add('atlas-single-check');
 }
}

function installStableEquipmentToggle(){
 if(slug!=='equipment'||typeof toggleList!=='function'||toggleList.__atlasStable)return;
 const stable=function(which,id){
  const a=state[which],was=a.includes(id);
  state[which]=was?a.filter(x=>x!==id):[...a,id];
  save();
  const isWish=state.wish.includes(id),isDone=state.done.includes(id);
  for(const card of document.querySelectorAll('.card')){
   const open=card.querySelector('[data-open="'+CSS.escape(id)+'"]');if(!open)continue;
   card.classList.toggle('collected',isDone);
   const wish=card.querySelector('[data-wish="'+CSS.escape(id)+'"]');
   const done=card.querySelector('[data-done="'+CSS.escape(id)+'"]');
   if(wish){wish.classList.toggle('selected',isWish);wish.textContent=isWish?'★':'☆';wish.setAttribute('aria-pressed',String(isWish))}
   if(done){done.classList.toggle('selected',isDone);done.textContent='✓';done.setAttribute('aria-pressed',String(isDone))}
  }
  if(current===id){
   const wish=document.querySelector('#detail [data-wish="'+CSS.escape(id)+'"]');
   const done=document.querySelector('#detail [data-done="'+CSS.escape(id)+'"]');
   if(wish){wish.classList.toggle('selected',isWish);wish.textContent=isWish?'★':'☆';wish.setAttribute('aria-pressed',String(isWish))}
   if(done){done.classList.toggle('selected',isDone);done.textContent='✓';done.setAttribute('aria-pressed',String(isDone))}
  }
  const doneCount=state.done.filter(id=>itemMap.has(id)).length,wishCount=state.wish.filter(id=>itemMap.has(id)).length,total=itemMap.size;
  const doneStat=document.getElementById('doneStat'),wishStat=document.getElementById('wishCount'),percentStat=document.getElementById('percentStat'),progressFill=document.getElementById('progressFill');
  if(doneStat)doneStat.textContent=String(doneCount);if(wishStat)wishStat.textContent=wishCount?String(wishCount):'';if(percentStat)percentStat.textContent=(total?Math.round(doneCount/total*100):0)+'%';if(progressFill)progressFill.style.width=(total?doneCount/total*100:0)+'%';
  if((tab==='wishlist'&&which==='wish')||(tab==='done'&&which==='done'))render();
  polishEquipmentControls();
  if(which==='wish')toast(was?'已移出想收集冊':'已加入想收集冊');
 };
 stable.__atlasStable=true;toggleList=stable;
}
function unifyReaderStateControls(){
 if(slug==='bosses'){
  for(const card of document.querySelectorAll('.card[data-id],.pet-card[data-pet-id]')){
   const wish=card.querySelector('.atlas-wish-button');
   let done=card.querySelector('.atlas-single-collect');
   if(!done){
    const input=card.dataset.petId?card.querySelector('input[data-pet-field="tamed"]'):card.querySelector('input[data-field="loot"]');
    if(input){
     done=document.createElement('label');done.className='atlas-single-collect';
     const update=()=>{done.title=input.checked?'取消已取得':'標記為已取得';done.setAttribute('aria-label',done.title)};
     input.addEventListener('change',update);update();done.append(input,document.createTextNode('✓'));
    }
   }
   if(!wish&&!done)continue;
   let wrap=card.querySelector('.atlas-reader-state');
   if(!wrap){wrap=document.createElement('div');wrap.className='atlas-reader-state';(card.querySelector('.cardtop')||card).append(wrap)}
   if(done&&done.parentElement!==wrap)wrap.append(done);
   if(wish&&wish.parentElement!==wrap)wrap.append(wish);
  }
 }
 if(slug==='skills'){
  for(const entry of document.querySelectorAll('.entry')){
   const title=entry.querySelector('.entry-title'),wish=entry.querySelector('.atlas-wish-button'),check=entry.querySelector('input.check');
   if(!title||!check)continue;
   let wrap=title.querySelector('.atlas-reader-state');
   if(!wrap){wrap=document.createElement('div');wrap.className='atlas-reader-state';title.append(wrap)}
   let done=wrap.querySelector('.atlas-skill-done');
   if(!done){done=document.createElement('label');done.className='atlas-skill-done';done.title=check.checked?'取消已取得':'標記為已取得';check.before(done);done.append(check,document.createTextNode('✓'))}
   done.title=check.checked?'取消已取得':'標記為已取得';
   if(done.parentElement!==wrap)wrap.append(done);
   if(wish&&wish.parentElement!==wrap)wrap.append(wish);
  }
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
   wish.classList.add('atlas-wish-icon-button');
   done.classList.add('atlas-done-icon');
   if(done.textContent!=='✓')done.textContent='✓';
   const title=card.querySelector('.item-open h3')?.textContent.trim()||'裝備';
   wish.setAttribute('aria-label',(wish.classList.contains('selected')?'從想收集移除：':'加入想收集：')+title);
   done.setAttribute('aria-label',(done.classList.contains('selected')?'取消已取得：':'標記為已取得：')+title);
 }
 const actions=document.querySelector('#detail .actions');
 if(actions){
  actions.classList.add('atlas-detail-state-row');
  const wish=actions.querySelector('[data-wish]'),done=actions.querySelector('[data-done]');
  if(wish){
   wish.classList.add('atlas-detail-state','atlas-detail-wish');
   wish.textContent=wish.classList.contains('selected')?'★':'☆';
   wish.setAttribute('aria-label',wish.classList.contains('selected')?'從想收集移除':'加入想收集');
  }
  if(done){
   done.classList.add('atlas-detail-state','atlas-detail-done');
   done.textContent='✓';
   done.setAttribute('aria-label',done.classList.contains('selected')?'取消已取得':'標記為已取得');
  }
 }
 renameCollectedLabels(document);
}
let polishTimer;
new MutationObserver(()=>{clearTimeout(polishTimer);polishTimer=setTimeout(()=>{renameCollectedLabels(document);polishEquipmentControls();unifyReaderStateControls();installFilterCompletion();removeAtlasUtilityButtons();normalizeEquipmentSearchDock();updateAtlasModeEmpty()},60)}).observe(document.body,{childList:true,subtree:true});
renameCollectedLabels(document);polishEquipmentControls();unifyReaderStateControls();

const find=id=>document.getElementById(id);
const input=(id,value)=>{const e=find(id);if(e){e.value=value;e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));}};
function focusPopupTarget(row){
 if(!atlasPopup||!row)return;
 document.documentElement.dataset.popupFocus='true';
 for(const other of atlasRows())other.hidden=other!==row;
 row.classList.add('atlas-popup-target');
 if(row.parentElement)row.parentElement.style.gridTemplateColumns='minmax(0,1fr)';
 const module=row.closest('.module');if(module){document.querySelectorAll('.module').forEach(m=>m.hidden=m!==module);module.querySelector('.modulehead')?.setAttribute('hidden','');}
}
function openTarget(d){
  if(slug==='equipment'){
    if(d.done==='done')document.querySelector('[data-tab="done"]')?.click();
    if(d.query){document.querySelector('[data-view="all"]')?.click();input('search',d.query);}
    if(d.id&&typeof drawDetail==='function'){drawDetail(d.id);if(atlasPopup){document.documentElement.dataset.popupFocus='true';document.body.style.overflow='auto';const overlay=document.getElementById('overlay');overlay?.classList.add('atlas-popup-flat');overlay?.querySelector('.sheetbar')?.setAttribute('hidden','');overlay?.querySelectorAll('[data-close],.close,.back').forEach(el=>el.setAttribute('hidden',''));}}
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
      if(c){const isPet=!!c.dataset.petId;document.querySelector(`[data-view="${isPet?'pets':'boss'}"]`)?.click();input(isPet?'pet-search':'search',d.id);c.querySelectorAll('details').forEach(e=>e.open=true);focusPopupTarget(c);c.scrollIntoView({block:'start',behavior:'instant'});}
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
  if(slug==='scarlet'){
  document.querySelector('header.masthead h1').textContent='緋紅獵人攻略';
  document.getElementById('chapter')?.setAttribute('hidden','');
  document.querySelectorAll('.filter-drawer,#toggleFilters,#filters,.chapter-select').forEach(el=>el.remove());
 }
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
  removeAtlasUtilityButtons();installFilterCompletion();
  if(slug==='equipment'){installStableEquipmentToggle();polishEquipmentControls();normalizeEquipmentSearchDock();}
  if(slug==='bosses'){enhanceSaintDragons();enhanceBerkDragons();polishPlayerFacingDetails();unifyBossCollectionChecks();unifyReaderStateControls();installSpeedSorting();installModelZoom();}
  if(slug==='skills')unifyReaderStateControls();
  if(slug==='scarlet'){polishScarletGuide();installScarletChapterScroll();}
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
