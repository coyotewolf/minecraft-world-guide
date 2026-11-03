"""Publish one checked Forge JAR and a signed feed; never includes private keys."""
from pathlib import Path
import argparse,datetime,hashlib,json,re,shutil,subprocess,zipfile,struct
p=argparse.ArgumentParser();p.add_argument('--site',required=True);p.add_argument('--node',required=True);args=p.parse_args()
mod=Path(__file__).resolve().parents[1];site=Path(args.site).resolve();version=re.search(r"^version='([^']+)'",(mod/'build.gradle').read_text(encoding='utf-8'),re.M).group(1)
assert re.fullmatch(r'(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})',version)
jar=mod/f'build/libs/aoi-ai-assistant-1.20.1-{version}.jar';raw_log=(mod/'update-verification.log').read_bytes();log=raw_log.decode('utf-16' if raw_log.startswith(b'\xff\xfe') else 'utf-8-sig',errors='replace')
assert 'BUILD SUCCESSFUL' in log and all(x in log for x in ('Update verification passed:','Announcement verification passed:','Client verification passed:','Command verification passed:','Nearby entity verification passed:'))
assert (mod/'update-verification.log').stat().st_mtime>=jar.stat().st_mtime
if tuple(map(int,version.split('.'))) >= (0,1,14):assert 'Registry ID verification passed:' in log
if tuple(map(int,version.split('.'))) >= (0,1,15):assert 'Biome verification passed:' in log
if tuple(map(int,version.split('.'))) >= (0,1,16):assert 'Player context verification passed:' in log
helper=json.loads((mod/'build/update-helper-checks.json').read_text(encoding='utf-8-sig'));assert helper.get('passed') is True and helper.get('version')==version and helper.get('jarHash')==hashlib.sha256(jar.read_bytes()).hexdigest(),'Helper tests must pass for this exact JAR'
with zipfile.ZipFile(jar) as z:
 assert z.testzip() is None and f'version="{version}"'.encode() in z.read('META-INF/mods.toml')
 assert 'aoi-update/apply-update.ps1' in z.namelist()
 assert z.read('aoi-update/apply-update.ps1')==(mod/'src/main/resources/aoi-update/apply-update.ps1').read_bytes(),'Packaged helper differs from tested source'
 if tuple(map(int,version.split('.'))) >= (0,1,13):
  assert 'Prelaunch verification passed:' in log
  assert 'Prelaunch setup verification passed:' in log
  assert z.read('aoi-update/prelaunch/build/updater.jar')==(mod/'build/prelaunch/updater.jar').read_bytes()
  for name in ('install.ps1','prelaunch.ps1','finalize-settings.ps1'):
   assert z.read('aoi-update/prelaunch/'+name)==(mod/'tools/prelaunch'/name).read_bytes()
 for name in z.namelist():
  assert 'aoichecks' not in name
  data=z.read(name);assert not re.search(rb'sb_secret_[\w-]+|AIza[\w-]{30,}|eyJhbGciOi[\w.-]{40,}',data)
  if name.endswith('.class'):assert struct.unpack('>H',data[6:8])[0]==61
now=datetime.datetime.now(datetime.timezone.utc);release=mod/f'release/{now:%Y-%m-%d}-v{version}';release.mkdir(parents=True,exist_ok=True)
hashvalue=hashlib.sha256(jar.read_bytes()).hexdigest();downloads=site/'downloads';downloads.mkdir(exist_ok=True)
if (downloads/jar.name).exists() and hashlib.sha256((downloads/jar.name).read_bytes()).hexdigest()!=hashvalue:raise RuntimeError('Published versions are immutable; increase the version.')
metadata={'protocol':1,'modId':'aoi_assistant','version':version,'minecraft':'1.20.1','loader':'forge','channel':'stable','url':f'https://coyotewolf.github.io/minecraft-world-guide/downloads/{jar.name}','sha256':hashvalue,'bytes':jar.stat().st_size,'publishedAt':now.isoformat().replace('+00:00','Z'),'expiresAt':(now+datetime.timedelta(days=180)).isoformat().replace('+00:00','Z')}
(release/'release-metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
subprocess.run([args.node,str(mod/'tools/sign-release.mjs'),str(release/'release-metadata.json'),str(release/'aoi-assistant-latest.json')],check=True)
for destination in (release/jar.name,downloads/jar.name):shutil.copy2(jar,destination)
shutil.copy2(release/'aoi-assistant-latest.json',downloads/'aoi-assistant-latest.json')
checksum=hashvalue+'  '+jar.name+'\n';(release/'SHA256SUMS.txt').write_text(checksum,encoding='utf-8',newline='\n');(downloads/f'aoi-ai-assistant-1.20.1-{version}.sha256').write_text(checksum,encoding='utf-8',newline='\n')
source=release/f'aoi-ai-assistant-{version}-source.zip'
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as z:
 for item in mod.rglob('*'):
  rel=item.relative_to(mod)
  if item.is_file() and not {'build','run','.gradle','release','__pycache__'}.intersection(rel.parts) and item.suffix not in {'.log','.dpapi','.tmp'}:z.write(item,'minecraft-client/'+rel.as_posix())
shutil.copy2(source,downloads/source.name)
guide=site/'ai-guide.js';text=guide.read_text(encoding='utf-8');text=re.sub(r'aoi-ai-assistant-1\.20\.1-\d+\.\d+\.\d+',f'aoi-ai-assistant-1.20.1-{version}',text);text=re.sub(r'AI 小助手 \d+\.\d+\.\d+',f'AI 小助手 {version}',text)
if '官方簽章自動更新' not in text:text=text.replace('Windows 可記住登入。','Windows 可記住登入，支援官方簽章自動更新：背景下載，關閉遊戲後備份並套用，下次啟動生效；可用 autoUpdate=false 關閉。')
guide.write_text(text,encoding='utf-8',newline='\n')
print(json.dumps(metadata,ensure_ascii=True))
