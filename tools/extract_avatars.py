from pathlib import Path
import zipfile,base64,json,struct
r=Path(__file__).resolve().parents[1];out=r/'assets/avatars';out.mkdir(exist_ok=True)
presets=[('steve','史蒂夫','player/wide/steve'),('alex','艾莉克絲','player/slim/alex'),('creeper','苦力帕','creeper/creeper'),('zombie','殭屍','zombie/zombie'),('skeleton','骷髏','skeleton/skeleton'),('enderman','終界使者','enderman/enderman'),('villager','村民','villager/villager'),('piglin','豬布林','piglin/piglin'),('wither_skeleton','凋零骷髏','skeleton/wither_skeleton'),('husk','屍殼','zombie/husk'),('drowned','沉屍','zombie/drowned'),('stray','流髑','skeleton/stray')]
with zipfile.ZipFile('D:/Games/MultiMC/libraries/com/mojang/minecraft/1.20.1/minecraft-1.20.1-client.jar') as z:
 for ident,label,texture in presets:
  data=z.read('assets/minecraft/textures/entity/'+texture+'.png');w,h=struct.unpack('>II',data[16:24]);encoded=base64.b64encode(data).decode('ascii')
  svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 8 8 8" shape-rendering="crispEdges"><image width="{w}" height="{h}" href="data:image/png;base64,{encoded}" style="image-rendering:pixelated"/></svg>'
  (out/(ident+'.svg')).write_text(svg,encoding='utf8')
(r/'data/avatar-sources.json').write_text(json.dumps({'minecraft':'1.20.1','source':'original client entity textures','rendering':'SVG viewport of the front face; source PNG bytes preserved','presets':[{'id':i,'name':n,'texture':'assets/minecraft/textures/entity/'+t+'.png'} for i,n,t in presets]},ensure_ascii=False,indent=2),encoding='utf8')
print('Extracted 12 original Minecraft face viewports.')
