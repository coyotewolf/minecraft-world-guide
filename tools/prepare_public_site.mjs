import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../',import.meta.url)),destination=process.argv[2]?path.resolve(process.argv[2]):path.join(source,'_site');
await fs.mkdir(destination,{recursive:true});
for(const directory of ['assets','data','guides','downloads'])await fs.cp(path.join(source,directory),path.join(destination,directory),{recursive:true});
for(const file of await fs.readdir(source))if((/\.(?:html|css|js)$/.test(file)&&!file.endsWith('.test.js'))||['site-config.json','theme-init.js','item-hints.js','popup-dismiss.js','boss-links.js','notification-worker.js','reader-boot.js','atlas-reader.js','atlas-reader.css','collection-controls.js','guide-progress.js','final-reader.js','tutorial-reference.js'].includes(file))await fs.copyFile(path.join(source,file),path.join(destination,file));
const html=await fs.readFile(path.join(destination,'index.html'),'utf8');if(!html.includes('Content-Security-Policy'))throw Error('CSP missing from published site');
for(const forbidden of ['cloud-ai','database','.git','.github','minecraft-client'])try{await fs.access(path.join(destination,forbidden));throw Error('Private build directory included: '+forbidden);}catch(e){if(e.code!=='ENOENT')throw e;}
console.log('Public site prepared with an explicit publish allowlist.');
