import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
await mkdir('outputs',{recursive:true});
await build({entryPoints:['hosted/supabase-edge.mjs'],outfile:'outputs/calendar-edge.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,plugins:[
  {name:'assets',setup(b){b.onResolve({filter:/^ya-assets$/},()=>({path:'assets',namespace:'embedded'}));b.onLoad({filter:/.*/,namespace:'embedded'},()=>({contents:'export default {};',loader:'js'}));}},
  {name:'crypto',setup(b){b.onResolve({filter:/^node:crypto$/},()=>({path:resolve('worker/crypto.mjs')}));}},
  {name:'deno-photos',setup(b){b.onResolve({filter:/\.\/images\.mjs$/},args=>args.importer.replaceAll('\\','/').endsWith('worker/index.mjs')?{path:resolve('hosted/deno-images.mjs')}:undefined);b.onResolve({filter:/^@cf-wasm\/photon\/(workerd|others)$/},()=>({path:'npm:@cf-wasm/photon@0.4.0/others',external:true}));}}
]});
console.log('Servidor Supabase compilado sin credenciales.');
