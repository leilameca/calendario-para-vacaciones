import {sha256} from '@noble/hashes/sha2.js';
import {hmac} from '@noble/hashes/hmac.js';
const bytes=v=>typeof v==='string'?new TextEncoder().encode(v):v;
function encode(v,format){if(format==='hex')return Array.from(v,b=>b.toString(16).padStart(2,'0')).join('');if(format==='base64url')return btoa(String.fromCharCode(...v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');return v;}
export function randomBytes(n){const v=crypto.getRandomValues(new Uint8Array(n));return{toString:f=>encode(v,f)};}
export function randomInt(n){const max=2**32-(2**32%n);let v;do{v=crypto.getRandomValues(new Uint32Array(1))[0];}while(v>=max);return v%n;}
export function createHash(){let data;return{update(v){data=bytes(v);return this;},digest(f){return encode(sha256(data),f);}};}
export function createHmac(_,key){let data;return{update(v){data=bytes(v);return this;},digest(f){return encode(hmac(sha256,bytes(key),data),f);}};}
export function timingSafeEqual(a,b){if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;}
export const equals=(a,b)=>typeof a==='string'&&typeof b==='string'&&timingSafeEqual(bytes(a),bytes(b));
