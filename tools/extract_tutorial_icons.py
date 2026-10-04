"""Extract genuine tutorial inventory icons; run after finalize_content.py. Requires Pillow and NumPy. Reads no player saves or credentials."""
from pathlib import Path
import json,hashlib,re,io
ROOT=Path('D:/Games/MultiMC/instances/1.20.12/.minecraft');OUT=Path(__file__).resolve().parents[1]
import pathlib,zipfile,base64,math
import numpy as np
from PIL import Image
archives={};index={}
client=ROOT.parents[2]/'libraries/net/minecraft/client/1.20.1-20230612.114412/client-1.20.1-20230612.114412-extra.jar'
enabled=[]
for line in (ROOT/'options.txt').read_text('utf8').splitlines():
 if line.startswith('resourcePacks:'):enabled=json.loads(line.split(':',1)[1])
files=[client,*sorted((ROOT/'mods').glob('*.jar'))]
files.extend(ROOT/'resourcepacks'/entry.removeprefix('file/')for entry in enabled if (ROOT/'resourcepacks'/entry.removeprefix('file/')).is_file())
for p in files:
 z=zipfile.ZipFile(p);archives[p.name]=z
 for n in z.namelist():
  if n.startswith('assets/')and n.endswith(('.json','.png','.obj','.mtl')):index[n]=p.name

def read(p):return archives[index[p]].read(p)
def resolve(ref,kind='models',suffix='.json'):
 ns,leaf=ref.split(':',1) if ':' in ref else ('minecraft',ref)
 return f'assets/{ns}/{kind}/{leaf}'+(suffix if not leaf.endswith(suffix) else '')
def model(ref,seen=None):
 seen=set() if seen is None else seen
 if isinstance(ref,dict):d=ref
 else:
  p=resolve(ref)
  if p in seen or p not in index:return {}
  seen.add(p);d=json.loads(read(p))
 if d.get('loader')=='forge:separate_transforms':
  chosen=d.get('perspectives',{}).get('gui',d.get('base',{}))
  d={**d,**chosen,'textures':{**d.get('textures',{}),**chosen.get('textures',{})}}
 parent=model(d['parent'],seen) if d.get('parent') else {}
 out={**parent,**d,'textures':{**parent.get('textures',{}),**d.get('textures',{})},'display':{**parent.get('display',{}),**d.get('display',{})}}
 if not out.get('elements') and not out.get('textures',{}).get('layer0') and out.get('overrides'):
  base=next((v for v in out['overrides'] if all(x==0 for x in v.get('predicate',{}).values())),None)
  if base:out=model(base['model'],seen)
 return out
def texpath(ref,ts):
 for _ in range(20):
  if not ref:return ''
  if not ref.startswith('#'):return resolve(ref,'textures','.png')
  ref=ts.get(ref[1:],'')
 return ''
def matrix(rot):
 x,y,z=np.radians(rot);cx,cy,cz=np.cos([x,y,z]);sx,sy,sz=np.sin([x,y,z])
 return np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])@np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])
FACES={'north':[0,1,2,3],'south':[5,4,7,6],'west':[4,0,3,7],'east':[1,5,6,2],'up':[3,2,6,7],'down':[4,5,1,0]}
def element_faces(d):
 faces=[];ts=d.get('textures',{})
 for e in d.get('elements',[]):
  a,b=np.array(e['from'],float),np.array(e['to'],float);x,y,z=a;X,Y,Z=b
  pts=np.array([[x,y,z],[X,y,z],[X,Y,z],[x,Y,z],[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]])
  r=e.get('rotation',{});axis=r.get('axis');ang=r.get('angle',0)
  if axis and ang:
   rot=[0,0,0];rot['xyz'.index(axis)]=ang;pivot=np.array(r.get('origin',[8,8,8]));pts=(pts-pivot)@matrix(rot).T
   if r.get('rescale'):
    scale=np.ones(3)/abs(math.cos(math.radians(ang)));scale['xyz'.index(axis)]=1;pts*=scale
   pts+=pivot
  for side,f in e.get('faces',{}).items():
   p=texpath(f.get('texture',''),ts)
   if p not in index:continue
   uv=f.get('uv',[0,0,16,16]);u,v,U,Vv=uv
   coords=np.array([[U,Vv],[u,Vv],[u,v],[U,v]])/16
   coords=np.roll(coords,int(f.get('rotation',0)/90),axis=0)
   faces.append((pts[FACES[side]],coords,p))
 return faces
def raster(faces,rot=(0,0,0),java=False):
 if not faces:return None
 rotation=matrix(rot)
 transformed=[(p@rotation.T,uv,t) for p,uv,t in faces]
 allp=np.concatenate([p for p,u,t in transformed]);lo=allp[:,:2].min(0);hi=allp[:,:2].max(0)
 span=max(hi-lo)
 if span<=0:return None
 scale=108/span;center=(lo+hi)/2;canvas=np.zeros((128,128,4),np.uint8);depth=np.full((128,128),-np.inf);textures={}
 for p,uv,t in transformed:
  screen=np.column_stack(((p[:,0]-center[0])*scale+64,64-(p[:,1]-center[1])*scale,p[:,2]))
  if t not in textures:textures[t]=np.array(Image.open(io.BytesIO(read(t))).convert('RGBA'))
  texture=textures[t];th,tw=texture.shape[:2]
  normal=np.cross(p[1]-p[0],p[2]-p[0]);norm=np.linalg.norm(normal)
  shade=.75+.25*abs(normal[2])/norm if norm else 1
  for tri in [(0,1,2),(0,2,3)]:
   v=screen[list(tri)];ut=uv[list(tri)];minx=max(0,int(np.floor(v[:,0].min())));maxx=min(127,int(np.ceil(v[:,0].max())));miny=max(0,int(np.floor(v[:,1].min())));maxy=min(127,int(np.ceil(v[:,1].max())))
   if maxx<minx or maxy<miny:continue
   yy,xx=np.mgrid[miny:maxy+1,minx:maxx+1];xx=xx+.5;yy=yy+.5
   den=(v[1,1]-v[2,1])*(v[0,0]-v[2,0])+(v[2,0]-v[1,0])*(v[0,1]-v[2,1])
   if abs(den)<1e-9:continue
   aa=((v[1,1]-v[2,1])*(xx-v[2,0])+(v[2,0]-v[1,0])*(yy-v[2,1]))/den
   bb=((v[2,1]-v[0,1])*(xx-v[2,0])+(v[0,0]-v[2,0])*(yy-v[2,1]))/den;cc=1-aa-bb
   zz=aa*v[0,2]+bb*v[1,2]+cc*v[2,2]
   u=aa*ut[0,0]+bb*ut[1,0]+cc*ut[2,0];vv=aa*ut[0,1]+bb*ut[1,1]+cc*ut[2,1]
   color=texture[np.clip((vv*th).astype(int),0,th-1),np.clip((u*tw).astype(int),0,tw-1)].copy()
   dep=depth[miny:maxy+1,minx:maxx+1];mask=(aa>=-1e-5)&(bb>=-1e-5)&(cc>=-1e-5)&(zz>=dep)&(color[:,:,3]>20)
   color[:,:,:3]=(color[:,:,:3]*shade).astype(np.uint8);canvas[miny:maxy+1,minx:maxx+1][mask]=color[mask];dep[mask]=zz[mask]
 im=Image.fromarray(canvas)
 return im if im.getbbox() else None

def boxfaces(origin,size,uv,texture,inflate=0,mirror=False,texture_size=None):
 x,y,z=origin;w,h,dep=size;u,v=uv
 rects={'west':[u,v+dep,u+dep,v+dep+h],'north':[u+dep,v+dep,u+dep+w,v+dep+h],'east':[u+dep+w,v+dep,u+dep+w+dep,v+dep+h],'south':[u+dep+w+dep,v+dep,u+2*dep+2*w,v+dep+h],'up':[u+dep,v,u+dep+w,v+dep],'down':[u+dep+w,v,u+dep+2*w,v+dep]}
 im=Image.open(io.BytesIO(read(texture)));tw,th=texture_size or im.size
 # JSON elements use UV in sixteenths; Java boxes use pixel coordinates.
 rects={side:{'texture':'#t','uv':[a/tw*16,b/th*16,c/tw*16,d/th*16]} for side,(a,b,c,d) in rects.items()}
 f=element_faces({'textures':{'t':texture.removeprefix('assets/').replace('/textures/',':').removesuffix('.png')},'elements':[{'from':[x-inflate,y-inflate,z-inflate],'to':[x+w+inflate,y+h+inflate,z+dep+inflate],'faces':rects}]})
 if mirror:f=[(p,uv[[1,0,3,2]],t) for p,uv,t in f]
 return f

def geo_faces(path,texture):
 d=json.loads(read(path));geometry=d['minecraft:geometry'][0];bones={b['name']:b for b in geometry['bones']};description=geometry['description'];texture_size=(description['texture_width'],description['texture_height'])
 def bone_pose(name):
  b=bones[name];r,t=bone_pose(b['parent']) if b.get('parent') in bones else (np.eye(3),np.zeros(3));br=matrix(b.get('rotation',[0,0,0]));pivot=np.array(b.get('pivot',[0,0,0]));return r@br,t+r@(pivot-br@pivot)
 faces=[]
 for b in geometry['bones']:
  br,bt=bone_pose(b['name'])
  for c in b.get('cubes',[]):
   uv=c.get('uv',[0,0])
   if isinstance(uv,dict):
    tw,th=texture_size;rects={}
    for side,v in uv.items():
     u,vv=v['uv'];w,h=v.get('uv_size',[0,0]);rects[side]={'uv':[u/tw*16,vv/th*16,(u+w)/tw*16,(vv+h)/th*16],'texture':'#t'}
    f=element_faces({'textures':{'t':texture.removeprefix('assets/').replace('/textures/',':').removesuffix('.png')},'elements':[{'from':c['origin'],'to':(np.array(c['origin'])+c['size']).tolist(),'faces':rects}]})
   else:f=boxfaces(c['origin'],c['size'],uv,texture,c.get('inflate',0),c.get('mirror',False),texture_size)
   pivot=np.array(c.get('pivot',[0,0,0]));cr=matrix(c.get('rotation',[0,0,0]))
   faces.extend((((p-pivot)@cr.T+pivot)@br.T+bt,u,t) for p,u,t in f)
 return faces

def obj_faces(path,ts):
 text=read(path).decode('utf8');verts=[];uvs=[];materials={};current='';faces=[];base=path.rsplit('/',1)[0]
 for line in text.splitlines():
  a=line.split()
  if not a:continue
  if a[0]=='mtllib':
   p=base+'/'+a[1]
   if p not in index:continue
   material=''
   for ml in read(p).decode('utf8').splitlines():
    m=ml.split()
    if not m:continue
    if m[0]=='newmtl':material=m[1]
    if m[0]=='map_Kd':materials[material]=texpath(m[-1],ts)
  if a[0]=='v':verts.append([float(v) for v in a[1:4]])
  if a[0]=='vt':uvs.append([float(a[1]),float(a[2])])
  if a[0]=='usemtl':current=a[1]
  if a[0]=='f' and materials.get(current) in index:
   face=[v.split('/') for v in a[1:]]
   for i in range(1,len(face)-1):
    tri=[face[0],face[i],face[i+1],face[i+1]];points=np.array([verts[int(v[0])-1] for v in tri]);coords=np.array([uvs[int(v[1])-1] for v in tri]);faces.append((points,coords,materials[current]))
 return faces

pack=json.loads((ROOT.parent/'mmc-pack.json').read_text('utf8'));forge=next(x['version']for x in pack['components']if x['uid']=='net.minecraftforge');forgejar=ROOT.parents[2]/'libraries/net/minecraftforge/forge'/('1.20.1-'+forge)/('forge-1.20.1-'+forge+'-universal.jar')
archives={forgejar.name:zipfile.ZipFile(forgejar),**archives}
icons=json.loads((OUT/'data/icons.json').read_text('utf8'));names=json.loads((OUT/'data/names.json').read_text('utf8'))
publishedicons=icons.copy()
articles=json.loads((OUT/'data/articles.json').read_text('utf8'));recipes=json.loads((OUT/'data/tutorial-recipes.json').read_text('utf8'))
tags={};languages={}
for archive,z in archives.items():
 for p in z.namelist():
  m=re.fullmatch(r'data/([^/]+)/tags/items/(.+)\.json',p)
  if m:
   try:
    d=json.loads(z.read(p));key=m[1]+':'+m[2]
    tags[key]=([]if d.get('replace')else tags.get(key,[]))+d.get('values',[])
   except Exception:pass
  if re.fullmatch(r'assets/[^/]+/lang/zh_tw.json',p):
   try:languages.update(json.loads(z.read(p).decode('utf-8-sig')))
   except Exception:pass
def tag_items(key,seen=None):
 seen=set()if seen is None else seen
 if key in seen:return []
 seen=seen|{key};out=[]
 for v in tags.get(key,[]):
  v=v.get('id','')if isinstance(v,dict)else v
  out+=tag_items(v[1:],seen)if v.startswith('#')else [v]
 return list(dict.fromkeys(out))
usedtags=set();needed={x['id']for a in articles for x in a['items']}
def scan(v):
 if isinstance(v,dict):
  if v.get('item'):needed.add(v['item'])
  if v.get('tag'):usedtags.add(v['tag'])
  for value in v.values():scan(value)
 elif isinstance(v,list):
  for value in v:scan(value)
scan(recipes)
stations={'minecraft:crafting_table','minecraft:furnace','minecraft:blast_furnace','minecraft:smoker','minecraft:stonecutter','minecraft:smithing_table','minecraft:anvil','create:mechanical_press','create:mechanical_mixer','create:mechanical_crafter','create:mechanical_saw','create:deployer','create:spout','create:depot','create:basin','create:blaze_burner','createmetallurgy:casting_table'}
needed|=stations
resolved={t:tag_items(t)for t in sorted(usedtags)}
for values in resolved.values():needed.update(values)
added=[];missing=[]
def save(ident,im,resources,method):
 im=im.convert('RGBA');bbox=im.getbbox()
 if not bbox:return False
 im=im.crop(bbox);scale=112/max(im.size);im=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.NEAREST)
 out=Image.new('RGBA',(128,128));out.alpha_composite(im,((128-im.width)//2,(128-im.height)//2));buf=io.BytesIO();out.save(buf,format='PNG');b=buf.getvalue();file='assets/art/'+hashlib.sha256(b).hexdigest()[:24]+'.png';(OUT/file).write_bytes(b);icons[ident]=file
 added.append({'id':ident,'file':file,'method':method,'resources':[{'archive':index[p],'path':p}for p in sorted(set(resources))if p in index]})
 return True
for ident in sorted(needed):
 ns,leaf=ident.split(':',1)
 for key in ['item.'+ns+'.'+leaf.replace('/','.'),'block.'+ns+'.'+leaf.replace('/','.')]:
  if key in languages:names.setdefault(ident,languages[key]);break
 if ident in icons and ident in publishedicons:continue
 ref=ident.replace(':',':item/');d=model(ref);ts=d.get('textures',{});layers=[texpath(ts[k],ts)for k in sorted(ts)if k.startswith('layer')];layers=[p for p in layers if p in index]
 if layers:
  im=None
  for p in layers:
   layer=Image.open(io.BytesIO(read(p))).convert('RGBA')
   if layer.height>layer.width and layer.height%layer.width==0:layer=layer.crop((0,0,layer.width,layer.width))
   if im is None:im=layer
   elif im.size==layer.size:im.alpha_composite(layer)
  if save(ident,im,[resolve(ref)]+layers,'inventory_texture'):continue
 faces=element_faces(d)
 if faces:
  gui=d.get('display',{}).get('gui',{});rot=gui.get('rotation',[30,225,0]);scale=gui.get('scale',[1,1,1]);faces=[(p*np.array(scale),u,t)for p,u,t in faces];im=raster(faces,rot)
  if im and save(ident,im,[resolve(ref)]+[f[2]for f in faces],'inventory_model'):continue
 missing.append({'id':ident,'model':resolve(ref),'loader':d.get('loader'),'parent':d.get('parent')})
for ident,texture in [('minecraft:water','minecraft:block/water_still'),('minecraft:lava','minecraft:block/lava_still')]:
 p=resolve(texture,'textures','.png')
 if p in index:
  im=Image.open(io.BytesIO(read(p))).convert('RGBA');im=im.crop((0,0,im.width,im.width))
  if ident.endswith('water'):
   pixels=np.array(im);pixels[:,:,:3]=(pixels[:,:,:3]*np.array([.25,.46,1])).astype(np.uint8);im=Image.fromarray(pixels)
  save(ident,im,[p],'fluid_texture')
def composite_faces(d):
 faces=element_faces(d)
 for child in d.get('children',{}).values():
  child=model(child);child['textures']={**d.get('textures',{}),**child.get('textures',{})};faces+=composite_faces(child)
 return faces
for entry in missing[:]:
 ident=entry['id'];ref=ident.replace(':',':item/');d=model(ref);faces=[];resources=[resolve(ref)];method='inventory_model'
 if d.get('loader')=='forge:composite':faces=composite_faces(d)
 elif d.get('loader')=='forge:obj':
  p=resolve(d['model'],'','').replace('//','/');faces=obj_faces(p,d.get('textures',{}));resources.append(p)
  if d.get('flip_v'):faces=[(pts,np.column_stack((uv[:,0],1-uv[:,1])),tex)for pts,uv,tex in faces]
  method='inventory_obj_model'
 elif ident=='functionalstorage:oak_1':
  block=ident.replace(':',':block/');faces=element_faces(model(block));resources.append(resolve(block))
 elif ident=='sophisticatedbackpacks:backpack':
  for part in ['backpack_base','backpack_front_pouch','backpack_left_pouch','backpack_right_pouch']:
   refpart='sophisticatedbackpacks:block/'+part;faces+=element_faces(model(refpart));resources.append(resolve(refpart))
  tintpaths={resolve('sophisticatedbackpacks:block/backpack_cloth','textures','.png'):13394234,resolve('sophisticatedbackpacks:block/backpack_border','textures','.png'):6434330}
  original_read=read
  def tinted_read(p):
   if p not in tintpaths:return original_read(p)
   im=Image.open(io.BytesIO(original_read(p))).convert('RGBA');arr=np.array(im);color=tintpaths[p];rgb=np.array([(color>>16)&255,(color>>8)&255,color&255])/255;arr[:,:,:3]=(arr[:,:,:3]*rgb).astype(np.uint8);buf=io.BytesIO();Image.fromarray(arr).save(buf,format='PNG');return buf.getvalue()
  read=tinted_read
 elif ident=='tacz:gun_smith_table':
  p='assets/tacz/models/bedrock/gun_smith_table.json';t='assets/tacz/textures/block/gun_smith_table.png';faces=geo_faces(p,t);resources +=[p,t];method='inventory_bedrock_model'
 elif ident=='enderstorage:ender_chest' or ident.startswith('quark:') or ident in ['minecraft:ender_chest','minecraft:trapped_chest']:
  if ident=='enderstorage:ender_chest':t='assets/enderstorage/textures/enderchest.png'
  elif ident.startswith('minecraft:'):t='assets/minecraft/textures/entity/chest/'+('ender'if ident=='minecraft:ender_chest'else'trapped')+'.png'
  else:
   name=ident.split(':')[1];trapped='_trapped_chest'in name;name=name.removesuffix('_trapped_chest').removesuffix('_chest');t=f'assets/quark/textures/quark_variant_chests/{name}/'+('trap.png'if trapped else'normal.png')
  if t in index:
   for origin,size,uv in [([1,6,1],[14,10,14],[0,19]),([1,2,1],[14,5,14],[0,0]),([7,1,0],[2,4,1],[0,0])]:faces.extend((p*[1,-1,1],u,tx)for p,u,tx in boxfaces(origin,size,uv,t))
   resources.append(t);method='chest_renderer_geometry'
 if faces:
  rot=d.get('display',{}).get('gui',{}).get('rotation',[30,225,0]);im=raster(faces,rot)
  if im:save(ident,im,resources+[f[2]for f in faces],method)
 if ident=='sophisticatedbackpacks:backpack':read=original_read
missing=[entry for entry in missing if entry['id']not in icons]
for fname,data in [('icons',icons),('names',names),('tutorial-item-tags',resolved)]:
 (OUT/'data'/f'{fname}.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
auditpath=OUT/'data/tutorial-artwork-sources.json';previous=json.loads(auditpath.read_text('utf8'))if auditpath.exists()else[]

(OUT/'data/tutorial-artwork-sources.json').write_text(json.dumps(list({x['id']:x for x in previous+added}.values()),ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(json.dumps({'added':len(added),'missing':missing,'tags':len(resolved)},ensure_ascii=False),flush=True)
