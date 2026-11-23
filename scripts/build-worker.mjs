import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const assetFiles={'/index.html':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/favicon.svg':['favicon.svg','image/svg+xml']};
const assets={};for(const[path,[file,type]]of Object.entries(assetFiles))assets[path]={type,body:await readFile('public/'+file,'utf8')};
await build({entryPoints:['worker/index.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,plugins:[
  {name:'assets',setup(b){b.onResolve({filter:/^ya-assets$/},()=>({path:'assets',namespace:'embedded'}));b.onLoad({filter:/.*/,namespace:'embedded'},()=>({contents:'export default '+JSON.stringify(assets),loader:'js'}));}},
  {name:'crypto',setup(b){b.onResolve({filter:/^node:crypto$/},()=>({path:resolve('worker/crypto.mjs')}));}},
  {name:'wasm',setup(b){b.onResolve({filter:/\.wasm$/},()=>({path:'./photon.wasm',external:true}));}}
]});
await copyFile('node_modules/@cf-wasm/photon/dist/lib/photon_rs_bg.wasm','dist/server/photon.wasm');
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await writeFile('dist/server/wrangler.json',JSON.stringify({name:'ya-casi',main:'index.js',compatibility_date:'2026-11-18',compatibility_flags:['nodejs_compat'],rules:[{type:'CompiledWasm',globs:['**/*.wasm'],fallthrough:true}],observability:{enabled:true}},null,2));
console.log('Worker y recursos compilados.');
