import {initPhoton} from '@cf-wasm/photon/others';
import {processPhoto as processPreparedPhoto} from '../worker/images.mjs';
let initialization;
async function initialize(){
  const response=await fetch('https://cdn.jsdelivr.net/npm/@cf-wasm/photon@0.4.0/dist/lib/photon_rs_bg.wasm',{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('No se pudo cargar el procesador de fotos.');
  const wasm=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',wasm);
  const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(hex!=='f477b87cbea0445c65fc7e580e89050190600379fcd44821cec67403483872b1')throw new Error('La verificación del procesador de fotos falló.');
  const module=await WebAssembly.compile(wasm);
  initPhoton.sync({module});
}
export async function processPhoto(data,focus){
  initialization??=initialize().catch(error=>{initialization=undefined;throw error;});
  await initialization;
  return processPreparedPhoto(data,focus);
}
