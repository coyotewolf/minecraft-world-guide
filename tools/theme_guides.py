"""Apply the journal's shared pixel palette to the preserved full guide readers."""
import pathlib
P=pathlib.Path(__file__).resolve().parents[1]
style='''<style id="world-reader-theme">
html[data-world-theme=dark],html[data-world-theme=dark] body{color-scheme:dark;--bg:#101c19!important;--surface:#1b2a24!important;--paper:#1b2a24!important;--card:#22352c!important;--raised:#2b4133!important;--soft:#2b4133!important;--input:#101c19!important;--text:#e8e9d3!important;--ink:#e8e9d3!important;--fg:#e8e9d3!important;--muted:#a6b8a8!important;--line:#405441!important;--accent:#a5d477!important;--tint:#2b4133!important}
html[data-world-theme=light],html[data-world-theme=light] body{color-scheme:light;--bg:#efe9d8!important;--surface:#faf6e9!important;--paper:#faf6e9!important;--card:#e4e4cf!important;--raised:#d4dfc2!important;--soft:#d4dfc2!important;--input:#faf6e9!important;--text:#26372d!important;--ink:#26372d!important;--fg:#26372d!important;--muted:#576b57!important;--line:#b8bda0!important;--accent:#41622c!important;--tint:#d4dfc2!important}
body{background:var(--bg)!important;color:var(--ink,var(--text,var(--fg)))!important}.card,button,input,select,textarea,.chapter,.panel{border-radius:0!important}#theme{display:none!important}button{min-height:44px}button:active{transform:translateY(2px)}html[data-motion=off] *{scroll-behavior:auto!important;animation:none!important;transition:none!important}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
</style><script>
(()=>{function apply(t,m){document.documentElement.dataset.worldTheme=t==='light'?'light':'dark';document.documentElement.dataset.theme=t==='light'?'light':'dark';document.body?.classList.toggle('dark',t!=='light');document.documentElement.dataset.motion=m||'on'}addEventListener('DOMContentLoaded',()=>{try{apply(parent.document.documentElement.dataset.theme,parent.document.documentElement.dataset.motion)}catch{apply('dark','on')}});addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='guide-theme')apply(e.data.theme,e.data.motion)})})();
</script>'''
for p in (P/'guides').glob('*.html'):
 s=p.read_text(encoding='utf8')
 if 'id="world-reader-theme"' not in s:s=s.replace('</head>',style+'</head>',1);p.write_text(s,encoding='utf8')
for p in (P/'guides').glob('*.html'):
 s=p.read_text(encoding='utf8')
 if '../vanilla.css' not in s:p.write_text(s.replace('</head>','<link rel="stylesheet" href="../vanilla.css?v=20261005-board1"></head>',1),encoding='utf8')
for p in (P/'guides').glob('*.html'):
 s=p.read_text(encoding='utf8')
 if '../polish.css' not in s:p.write_text(s.replace('</head>','<script src="../reader-polish.js?v=20261005-board1" defer></script><link rel="stylesheet" href="../polish.css?v=20261005-board1"></head>',1),encoding='utf8')
for p in (P/'guides').glob('*.html'):
 s=p.read_text(encoding='utf8')
 for asset in ['boss-links.js','board.css']:
  if '../'+asset not in s:
   tag=('<script src="../'+asset+'?v=20261005-board1" defer></script>') if asset.endswith('.js') else ('<link rel="stylesheet" href="../'+asset+'?v=20261005-board1">')
   s=s.replace('</head>',tag+'</head>',1)
 p.write_text(s,encoding='utf8')
print('Four complete readers share the journal palette, pixel controls and motion preference.')
