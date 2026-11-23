import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';

test('el procesador de Supabase compila el WASM y recodifica JPG, PNG y WebP',async()=>{
  const photonURL=import.meta.resolve('@cf-wasm/photon/others');
  const bundle=await build({entryPoints:['hosted/deno-images.mjs'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'photon-runtime',setup(b){b.onResolve({filter:/^@cf-wasm\/photon\/(others|workerd)$/},()=>({path:photonURL,external:true}));}}]});
  const {processPhoto}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const wasm=await readFile('node_modules/@cf-wasm/photon/dist/lib/photon_rs_bg.wasm');
  const originalFetch=globalThis.fetch;let downloads=0;
  globalThis.fetch=async url=>{assert.equal(url,'https://cdn.jsdelivr.net/npm/@cf-wasm/photon@0.4.0/dist/lib/photon_rs_bg.wasm');downloads++;return new Response(wasm);};
  try{
    for(const format of ['jpeg','png','webp']){
      const photo=await sharp({create:{width:240,height:360,channels:3,background:'#24634e'}})[format]().toBuffer();
      const result=await processPhoto(photo.toString('base64'),0);
      for(const [name,width]of [['full',256],['thumb',80]]){const meta=await sharp(result[name]).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,width);assert.equal(meta.height,width);assert.equal(meta.exif,undefined);}
    }
    assert.equal(downloads,1);
  }finally{globalThis.fetch=originalFetch;}
});
