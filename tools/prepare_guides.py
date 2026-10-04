import pathlib,re,json,base64,hashlib,sys
P=pathlib.Path(__file__).resolve().parents[1];D=P/'data'
sys.path.insert(0,str(pathlib.Path('work/boss_lib').resolve()))
from bs4 import BeautifulSoup
icons={};count=0
def asset(uri):
 global count
 if not isinstance(uri,str) or not uri.startswith('data:image/'):return uri
 m=re.match(r'data:image/([\w+.-]+);base64,(.+)',uri,re.S)
 if not m:return uri
 ext='svg' if m[1]=='svg+xml' else m[1];raw=base64.b64decode(m[2]);h=hashlib.sha256(raw).hexdigest()[:24];dest=P/'assets'/'art'/f'{h}.{ext}'
 dest.parent.mkdir(exist_ok=True,parents=True)
 if not dest.exists():dest.write_bytes(raw);count+=1
 return '../assets/art/'+dest.name
for slug in ['skills','scarlet','equipment','bosses']:
 p=P/'guides'/f'{slug}.html';s=BeautifulSoup(p.read_text(encoding='utf8'),'html.parser')
 for img in s.find_all('img'):img['loading']='lazy'
 if slug=='equipment':
  d=json.loads(s.find('script',type='application/json').string)
  for id,src in d.get('icons',{}).items():
   if isinstance(src,str) and src.startswith('data:image'):icons[id]=asset(src).replace('../','')
 elif slug=='skills':
  for script in s.find_all('script'):
   t=script.string or '';m=re.search(r'const icons\s*=\s*',t)
   if m:
    try:
     d,end=json.JSONDecoder().raw_decode(t[m.end():]);
     for id,src in d.items():
      if isinstance(src,str) and src.startswith('data:image'):icons[id]=asset(src).replace('../','')
    except Exception:pass
 elif slug=='bosses':
  for c in s.select('.card,.pet-card'):
   img=c.find('img');id=c.get('data-id') or c.get('data-pet-id')
   if img and img.get('src','').startswith('data:image'):icons[id]=asset(img['src']).replace('../','')
 # Extract embedded assets losslessly. No game JAR is redistributed.
 html=str(s)
 html=re.sub(r'data:image/[\w+.-]+;base64,[A-Za-z0-9+/=]+',lambda m:asset(m[0]),html)
 bridge='''<script>
(()=>{const real=window.localStorage,slug=SLUG,uid=new URLSearchParams(location.search).get('player')||'guest',prefix='iaa-guide-'+uid+'-'+slug+'-';
const store={getItem:k=>real.getItem(prefix+k),setItem:(k,v)=>{real.setItem(prefix+k,String(v));notify()},removeItem:k=>{real.removeItem(prefix+k);notify()},clear:()=>{},key:i=>Object.keys(real).filter(k=>k.startsWith(prefix))[i]?.slice(prefix.length),get length(){return Object.keys(real).filter(k=>k.startsWith(prefix)).length}};
Object.defineProperty(window,'localStorage',{value:store});
function notify(){const data={};for(const k of Object.keys(real))if(k.startsWith(prefix))data[k.slice(prefix.length)]=real.getItem(k);parent.postMessage({type:'guide-progress',slug,data},location.origin)}
addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;const d=e.data;if(d?.type==='guide-open'){
 if(slug==='equipment'&&typeof drawDetail==='function')drawDetail(d.id);
 else if(slug==='bosses'){const c=[...document.querySelectorAll('[data-id],[data-pet-id]')].find(c=>c.dataset.id===d.id||c.dataset.petId===d.id);if(c){document.querySelector('[data-view='+ (c.dataset.petId?'pets':'boss') +']')?.click();c.hidden=false;c.closest('section')?.removeAttribute('hidden');c.scrollIntoView({block:'start'});}}
 else if(slug==='skills'){const q=document.getElementById('search');if(q){q.value=d.query||d.id;q.dispatchEvent(new Event('input',{bubbles:true}));}}
}});addEventListener('load',()=>parent.postMessage({type:'guide-ready',slug},location.origin));})();
</script>'''.replace('SLUG',json.dumps(slug))
 style='''<style>html{scroll-behavior:smooth}body{margin:0!important}img{max-width:100%}header{position:relative!important}.world-guide-banner{font:14px/1.6 system-ui;padding:12px 16px;background:#273b32;color:#ecf5da;border-bottom:3px solid #8dcf64}input,button,textarea,select{font-size:max(16px,1em)}@media(max-width:480px){table{display:block;overflow:auto}body{min-width:0!important}}
</style>'''
 html=html.replace('<head>','<head>'+bridge+style,1)
 if '../atlas-reader.js' not in html:html=html.replace('</head>','<link rel="stylesheet" href="../atlas-reader.css?v=20261004-hints2"><script src="../atlas-reader.js?v=20261004-hints2" defer></script></head>',1)
 html=re.sub(r'(<body[^>]*>)',r'\1<div class="world-guide-banner">完整原攻略・紀錄與目前玩家分開保存。快捷鍵請以「世界攻略 → 操作」和個人控制設定為準；伺服器數值尚未查核。</div>',html,count=1)
 p.write_text(html,encoding='utf8')
(D/'icons.json').write_text(json.dumps(icons,separators=(',',':')),encoding='utf8')
print('unique embedded art assets',count,'catalog icons',len(icons))
