"""Fail publishing on recognizable credentials; never print credential values."""
import argparse,base64,hashlib,io,json,re,subprocess,sys,zipfile
from pathlib import Path
PATTERNS={
 'google_api_key':rb'AIza[0-9A-Za-z_-]{35}',
 'supabase_secret':rb'sb_secret_[A-Za-z0-9_-]{16,}',
 'openai_key':rb'sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}',
 'github_token':rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})',
 'private_key':rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----',
 'jwt':rb'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}',
 'aws_access_id':rb'(?:AKIA|ASIA)[A-Z0-9]{16}'
}
MARKERS={'google_api_key':b'AIza','supabase_secret':b'sb_secret_','openai_key':b'sk-','github_token':b'gh','private_key':b'PRIVATE KEY-----','jwt':b'eyJ','aws_access_id':b'IA'}
ASSIGNED_NAMES=[b'gemini_api',b'openai_api_key',b'cloudflare_api_token',b'cloudflare_quota_token',b'supabase_service_role_key',b'oauth_token',b'refresh_token',b'client_secret']
ASSIGNED=re.compile(rb'(?i)(?:gemini_api(?:_key)?|openai_api_key|cloudflare_api_token|cloudflare_quota_token|supabase_service_role_key|oauth_token|refresh_token|client_secret)\s*["\']?\s*[=:]\s*["\']([^"\'\r\n]{16,})["\']')
class Scanner:
 def __init__(self):self.seen=set();self.findings=[];self.contents=0;self.bytes=0
 def record(self,kind,value,path):self.findings.append({'type':kind,'path':path,'fingerprint':hashlib.sha256(value).hexdigest()[:16]})
 def scan(self,data,path,depth=0):
  digest=hashlib.sha256(data).digest()
  if digest in self.seen:return
  self.seen.add(digest);self.contents+=1;self.bytes+=len(data)
  for name,pat in PATTERNS.items():
   if MARKERS[name] not in data:continue
   for m in re.finditer(pat,data):
    value=m.group()
    if name=='jwt':
     try:
      part=value.split(b'.')[1];claims=json.loads(base64.urlsafe_b64decode(part+b'='*((-len(part))%4)))
      if claims.get('role')=='anon':continue
     except (ValueError,KeyError):pass
    self.record(name,value,path)
  for m in (ASSIGNED.finditer(data) if any(n in data.lower() for n in ASSIGNED_NAMES) else []):
   v=m.group(1)
   if re.fullmatch(rb'[A-Za-z0-9_./+=-]{16,}',v) and not any(x in v.lower() for x in [b'example',b'placeholder',b'test',b'your',b'process.',b'env.',b'change',b'fake']):self.record('assigned_credential',v,path)
  if data.startswith(b'PK\x03\x04'):
   if depth>=3:raise ValueError('Archive depth limit: '+path)
   with zipfile.ZipFile(io.BytesIO(data)) as archive:
    total=0
    for entry in archive.infolist():
     if entry.is_dir():continue
     total+=entry.file_size
     if entry.file_size>50*1024*1024 or total>200*1024*1024:raise ValueError('Archive size limit: '+path)
     self.scan(archive.read(entry),path+'!'+entry.filename,depth+1)
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--history',action='store_true');args=parser.parse_args()
 root=Path(__file__).resolve().parents[1]
 def git(*cmd):return subprocess.check_output(['git','-C',str(root),*cmd])
 scanner=Scanner()
 for file in git('ls-files','--cached','--others','--exclude-standard','-z').decode().split('\0'):
  if file and (root/file).is_file():scanner.scan((root/file).read_bytes(),file)
 if args.history:
  objects=git('rev-list','--objects','--all').decode().splitlines();names={line.split(' ',1)[0]:line.split(' ',1)[-1] for line in objects}
  metadata=subprocess.check_output(['git','-C',str(root),'cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],input=('\n'.join(names)+'\n').encode()).decode().splitlines()
  proc=subprocess.Popen(['git','-C',str(root),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
  try:
   for line in metadata:
    oid,kind,size=line.split();size=int(size)
    if kind not in ('blob','commit','tag'):continue
    if size>50*1024*1024:raise ValueError('History object exceeds scan limit: '+oid)
    proc.stdin.write((oid+'\n').encode());proc.stdin.flush();proc.stdout.readline();body=proc.stdout.read(size)
    if proc.stdout.read(1)!=b'\n':raise ValueError('Incomplete Git object')
    scanner.scan(body,oid+':'+names[oid])
  finally:proc.stdin.close();proc.stdout.close();proc.wait()
 print(json.dumps({'contents':scanner.contents,'bytes':scanner.bytes,'findings':scanner.findings},ensure_ascii=False))
 return 1 if scanner.findings else 0
if __name__=='__main__':sys.exit(main())
