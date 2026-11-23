import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const assets={};for(const [path,file,type]of [['/index.html','index.html','text/html; charset=utf-8'],['/app.js','app.js','text/javascript; charset=utf-8'],['/style.css','style.css','text/css; charset=utf-8'],['/favicon.svg','favicon.svg','image/svg+xml']])assets[path]={body:await readFile('public/'+file,'utf8'),type};
await mkdir('.vercel-build',{recursive:true});
await build({entryPoints:['hosted/entry.mjs'],outfile:'.vercel-build/server.mjs',bundle:true,platform:'node',target:'node24',format:'esm',external:['sharp'],plugins:[
  {name:'assets',setup(b){b.onResolve({filter:/^ya-assets$/},()=>({path:'assets',namespace:'embedded'}));b.onLoad({filter:/.*/,namespace:'embedded'},()=>({contents:'export default '+JSON.stringify(assets),loader:'js'}));}},
  {name:'node-photos',setup(b){b.onResolve({filter:/\.\/images\.mjs$/},args=>args.importer.replaceAll('\\','/').endsWith('worker/index.mjs')?{path:resolve('hosted/images.mjs')}:undefined);}}
]});
console.log('Servidor Vercel compilado.');
