import sharp from 'sharp';
import {assert,AppError} from '../lib/rules.mjs';
export async function processPhoto(data,focus=.5){
  assert(typeof data==='string'&&data.length<=7000000,'La foto supera los 5 MB.');
  const bytes=Buffer.from(data,'base64');assert(bytes.length<=5*1024*1024,'La foto supera los 5 MB.');
  try{
    const photo=sharp(bytes,{limitInputPixels:8000000,animated:false}),meta=await photo.metadata();
    assert(['jpeg','png','webp'].includes(meta.format)&&!(meta.pages>1),'Usa una foto JPG, PNG o WebP sin animación.');
    const oriented=await photo.rotate().toBuffer({resolveWithObject:true}),side=Math.min(oriented.info.width,oriented.info.height);
    const f=Number.isFinite(Number(focus))?Math.min(1,Math.max(0,Number(focus))):.5;
    const square=sharp(oriented.data).extract({left:Math.round((oriented.info.width-side)*f),top:Math.round((oriented.info.height-side)*f),width:side,height:side});
    const [full,thumb]=await Promise.all([square.clone().resize(256,256).webp({quality:82}).toBuffer(),square.clone().resize(80,80).webp({quality:78}).toBuffer()]);return{full,thumb};
  }catch(error){if(error.status)throw error;throw new AppError('La foto no es válida. Usa JPG, PNG o WebP de hasta 8 megapíxeles.');}
}
