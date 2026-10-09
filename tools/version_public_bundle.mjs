import fs from 'node:fs/promises';
const revision=process.env.SITE_REVISION;if(!/^[a-f0-9]{40}$/.test(revision||''))throw Error('Invalid website revision');
const file=new URL('../index.html',import.meta.url),html=await fs.readFile(file,'utf8');await fs.writeFile(file,html.replace(/assets\/app\.min\.js\?v=[^" ]+/, 'assets/app.min.js?v='+revision));
