import pathlib,re,json,sys
sys.path.insert(0,str(pathlib.Path('work/boss_lib').resolve()))
from bs4 import BeautifulSoup
for name in ['skills-spells-guide.html','scarlet-hunter-guide.html','特殊武器與防具全收集.html','boss-collection.html']:
 p=pathlib.Path('C:/Users/coyot/Downloads')/name
 s=BeautifulSoup(p.read_text(encoding='utf-8'),'html.parser')
 print('\nFILE',name)
 for x in s.find_all('script'):
  t=x.string or x.get_text()
  print('SCRIPT',x.get('type'),len(t),t[:180].replace('\n',' '))
  print('DECL',re.findall(r'(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\[{])',t)[:25])
 print('CARDS',len(s.select('.card')),len(s.select('[data-id]')),len(s.select('[data-pet-id]')))
 for c in s.select('.card')[:1]:print(str(c)[:900])
