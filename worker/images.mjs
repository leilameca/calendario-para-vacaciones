import {PhotonImage,SamplingFilter,resize,crop,rotate,fliph,flipv} from '@cf-wasm/photon/workerd';
import {imageSize} from 'image-size';
import {assert,AppError} from '../lib/rules.mjs';

export function processPhoto(data,focus=.5){
  assert(typeof data==='string'&&data.length<=7000000,'La foto supera los 5 MB.');
  let bytes,meta;try{const raw=atob(data);bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));assert(bytes.length<=5*1024*1024,'La foto supera los 5 MB.');meta=imageSize(bytes);}catch(err){if(err.status)throw err;throw new AppError('El archivo no es una imagen válida.');}
  assert(['jpg','png','webp'].includes(meta.type),'Usa JPG, PNG o WebP.');
  assert(meta.width*meta.height<=8000000,'Reduce la fotografía a menos de 8 megapíxeles.');
  if(meta.type==='png')assert(!contains(bytes,'acTL'),'Usa una foto sin animación.');
  if(meta.type==='webp')assert(!contains(bytes,'ANIM'),'Usa una foto sin animación.');
  const images=[];const keep=img=>{images.push(img);return img;};
  try{
    let image=keep(PhotonImage.new_from_byteslice(bytes));
    const o=meta.orientation||1;
    if([2,5,7].includes(o))fliph(image);if(o===4)flipv(image);
    const angle=({3:180,5:270,6:90,7:90,8:270})[o];if(angle)image=keep(rotate(image,angle));
    const width=image.get_width(),height=image.get_height(),side=Math.min(width,height),f=Number.isFinite(Number(focus))?Math.max(0,Math.min(1,Number(focus))):.5;
    const left=Math.round((width-side)*f),top=Math.round((height-side)*f);
    const square=keep(crop(image,left,top,left+side,top+side));
    const full=keep(resize(square,256,256,SamplingFilter.Lanczos3)).get_bytes_webp();
    const thumb=keep(resize(square,80,80,SamplingFilter.Lanczos3)).get_bytes_webp();
    return {full,thumb};
  }catch(err){if(err.status)throw err;throw new AppError('No pudimos procesar esa foto. Prueba con otra imagen JPG o PNG.');}
  finally{for(const image of images.reverse())image.free();}
}
function contains(bytes,value){const target=new TextEncoder().encode(value);for(let i=0;i<bytes.length-target.length;i++){if(target.every((b,j)=>bytes[i+j]===b))return true;}return false;}
