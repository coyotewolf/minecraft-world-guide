import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const keyDir=path.join(process.env.LOCALAPPDATA,'AOI','Deployment','updates');
await fs.mkdir(keyDir,{recursive:true});const keyFile=path.join(keyDir,'release-ed25519.pkcs8');
if(process.argv.includes('--init-key')){
 try{await fs.access(keyFile)}catch{const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');await fs.writeFile(keyFile,privateKey.export({type:'pkcs8',format:'der'}),{flag:'wx'});await fs.writeFile(path.join(keyDir,'release-ed25519-public.der'),publicKey.export({type:'spki',format:'der'}),{flag:'wx'});}
 const privateKey=crypto.createPrivateKey({key:await fs.readFile(keyFile),type:'pkcs8',format:'der'});console.log(crypto.createPublicKey(privateKey).export({type:'spki',format:'der'}).toString('base64'));process.exit(0);
}
const metadata=JSON.parse(await fs.readFile(process.argv[2],'utf8'));const privateKey=crypto.createPrivateKey({key:await fs.readFile(keyFile),type:'pkcs8',format:'der'});
const java=await fs.readFile(new URL('../src/main/java/io/github/coyotewolf/aoi/update/ReleaseManifest.java',import.meta.url),'utf8');
if(crypto.createPublicKey(privateKey).export({type:'spki',format:'der'}).toString('base64')!==java.match(/PUBLIC_KEY="([^"]+)"/)[1])throw Error('Signing key differs from client trust key.');
try{const previous=JSON.parse(await fs.readFile(process.argv[3],'utf8'));const bytes=Buffer.from(previous.payload,'base64');if(!crypto.verify(null,bytes,crypto.createPublicKey(privateKey),Buffer.from(previous.signature,'base64')))throw Error('Previous manifest signature is invalid.');const before=JSON.parse(bytes);const a=metadata.version.split('.').map(Number),b=before.version.split('.').map(Number);let compare=0;for(let i=0;i<3;i++){if(a[i]!==b[i]){compare=a[i]-b[i];break}}if(compare<0||compare===0&&metadata.sha256!==before.sha256)throw Error('Refusing downgrade or replacement of an existing release.');}catch(e){if(e.code!=='ENOENT')throw e;}
const payload=Buffer.from(JSON.stringify(metadata));const envelope={payload:payload.toString('base64'),signature:crypto.sign(null,payload,privateKey).toString('base64')};
await fs.writeFile(process.argv[3],JSON.stringify(envelope)+'\n');console.log('Signed release manifest.');
