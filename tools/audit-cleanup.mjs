const IDS=new Set(['dfbc1d3a-c7aa-4e74-995c-0e8e36b6ee6b','c6136112-41bf-4245-8351-ebf0d3b66d00','a87207a4-96a8-4733-8fe5-e57811104f1d']);
export function auditKey(key){
 const p=key.split(':');
 if(['conversation','request','context-request','history-epoch','minute','limit'].includes(p[0]))return IDS.has(p[1]);
 if(p[0]==='cache'&&['intent','answer'].includes(p[1]))return IDS.has(p[2]);
 if(p[0]==='user'&&/^\d{4}-\d{2}-\d{2}$/.test(p[1]))return IDS.has(p[2]);
 if(p[0]==='quota-change'&&p[1]==='limit')return IDS.has(p[2]);
 return false;
}
export async function purgeAuditFixtures(storage,inflight,now=Date.now()){
 if(now>Date.parse('2026-10-24T18:00:00Z'))throw Error('maintenance expired');
 if([...inflight.keys()].some(auditKey))throw Error('fixture work still active');
 return storage.transaction(async tx=>{
  let after,deleted=0,retained=0;
  do{const page=await tx.list({limit:100,...(after?{startAfter:after}:{})});const keys=[];
   for(const key of page.keys()){after=key;if(auditKey(key))keys.push(key);else retained++}
   if(keys.length){await tx.delete(keys);deleted+=keys.length}if(page.size<100)break;
  }while(true);
  let remaining=0;after=undefined;
  do{const page=await tx.list({limit:100,...(after?{startAfter:after}:{})});for(const key of page.keys()){after=key;if(auditKey(key))remaining++}if(page.size<100)break}while(true);
  return {deleted,remaining,retained,scope:'three-authorized-audit-accounts'};
 });
}
