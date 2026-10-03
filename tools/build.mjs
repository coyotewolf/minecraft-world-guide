import {build} from 'esbuild';
import fs from 'node:fs/promises';
await fs.mkdir('assets',{recursive:true});
await build({entryPoints:['app.js'],bundle:true,minify:true,format:'esm',target:['es2022'],outfile:'assets/app.min.js'});
console.log('Website bundle built.');
