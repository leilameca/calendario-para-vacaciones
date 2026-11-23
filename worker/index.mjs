import {createRules,hash,token,todayIn,dateRange,automatic,assert,AppError} from '../lib/rules.mjs';
import {createHmac,equals} from './crypto.mjs';
import {processPhoto} from './images.mjs';
import assets from 'ya-assets';

const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; media-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8',...extra}});
const photoSign=(s,id,size,exp)=>createHmac('sha256',s.photoSecret).update(`${id}:${size}:${exp}`).digest('base64url');
const photoURL=(s,id,size='full')=>{if(!id)return null;const exp=Math.floor(Date.now()/1000)+900;return `/api/photo/${id}?size=${size}&exp=${exp}&sig=${photoSign(s,id,size,exp)}`;};
function snapshot(s,admin){
  const today=todayIn(new Date()),range=dateRange(s.config.start,s.config.lastWork);
  const participants=s.participants.map(p=>({...p,photo:photoURL(s,p.photo,'thumb'),photoId:admin?p.photo:undefined,turns:Object.values(s.days).filter(d=>d.participantId===p.id&&d.status==='completed').length,lastTurn:Object.values(s.days).filter(d=>d.participantId===p.id).map(d=>d.date).sort().at(-1)||null}));
  const mapDay=date=>{const d=s.days[date]||{date,status:date<today?'pending':'future',source:automatic(date,s.config)?'system':'human',reactions:{}};const counts={};for(const emoji of Object.values(d.reactions||{}))counts[emoji]=(counts[emoji]||0)+1;return{...d,photo:photoURL(s,d.photo),reactions:counts};};
  const days=range.map(mapDay);
  return{serverNow:new Date().toISOString(),today,version:s.version,config:s.config,participants:admin?participants:participants.filter(p=>p.active),days,archived:admin?Object.keys(s.days).filter(d=>!range.includes(d)).sort().map(mapDay):[],events:admin?s.events.slice(-300).reverse():undefined,admin,remainingTurns:days.filter(d=>d.source==='human'&&!['completed','omitted'].includes(d.status)).length};
}
async function read(db,env){
  let row=await db.prepare('SELECT body,revision FROM app WHERE id=1').first();
  if(!row){assert(env.INITIAL_STATE_JSON,'El calendario está terminando su configuración.',503);const initial=JSON.parse(env.INITIAL_STATE_JSON);initial.publicToken=env.INITIAL_PUBLIC_TOKEN;await db.prepare('INSERT OR IGNORE INTO app(id,body,revision) VALUES(1,?,1)').bind(JSON.stringify(initial)).run();row=await db.prepare('SELECT body,revision FROM app WHERE id=1').first();}
  return{s:JSON.parse(row.body),revision:row.revision};
}
async function transaction(db,env,fn){
  for(let i=0;i<40;i++){
    const {s,revision}=await read(db,env),before=JSON.stringify(s),out=fn(s);
    const body=JSON.stringify(s);if(body===before)return{out,s};
    const result=await db.prepare('UPDATE app SET body=?,revision=revision+1 WHERE id=1 AND revision=?').bind(body,revision).run();
    if(result.meta.changes===1)return{out,s};
  }
  throw new AppError('El calendario recibió varios cambios a la vez. Inténtalo de nuevo.',409);
}
async function body(req,max=100000){
  const reader=req.body?.getReader();if(!reader)return{};const chunks=[];let length=0;
  while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw new AppError('El archivo supera el tamaño permitido.',413);}chunks.push(value);}
  const all=new Uint8Array(length);let at=0;for(const chunk of chunks){all.set(chunk,at);at+=chunk.length;}try{return JSON.parse(new TextDecoder().decode(all)||'{}');}catch{throw new AppError('Datos inválidos.');}
}
async function handle(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(assets[path])return new Response(assets[path].body,{headers:{...headers,'Content-Type':assets[path].type}});
  if(path==='/admin/'||/^\/c\/[A-Za-z0-9_-]{43}$/.test(path))return new Response(assets['/index.html'].body,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
  if(!path.startsWith('/api/'))return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ya casi</title><link rel="stylesheet" href="/style.css"><main class="fatal"><span class="brand">✳ ya casi.</span><h1 style="margin-top:30px">Cada día, más cerca.</h1><p>Abre el enlace de participación que te compartió tu equipo.</p></main></html>',{status:path==='/'?200:404,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
  const db=env.DB.withSession('first-primary');
  if(request.method!=='GET'){
    assert(request.headers.get('Origin')===url.origin,'Solicitud desde un origen no permitido.',403);
    const minute=Math.floor(Date.now()/60000),ip=request.headers.get('CF-Connecting-IP')||'local',kind=path==='/api/auth'?'auth':'write',key=hash(ip)+':'+kind+':'+minute;
    const limit=await db.prepare('INSERT INTO rate_limits(key,minute,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,minute).first();
    assert(limit.hits<=(kind==='auth'?20:120),'Demasiadas solicitudes. Espera un minuto.',429);
    ctx.waitUntil(db.prepare('DELETE FROM rate_limits WHERE minute<?').bind(minute-5).run());
  }
  const rules=createRules(),{s}=await read(db,env);
  if(path==='/api/tick'&&request.method==='GET'){await transaction(db,env,current=>rules.reconcile(current));return json({ok:true,today:todayIn(new Date())});}
  if(path.startsWith('/api/photo/')&&request.method==='GET'){
    const id=path.split('/').at(-1),size=url.searchParams.get('size'),exp=Number(url.searchParams.get('exp')),sig=url.searchParams.get('sig');
    assert(/^[A-Za-z0-9_-]{24}$/.test(id)&&['full','thumb'].includes(size)&&exp>=Date.now()/1000&&exp<=Date.now()/1000+1800,'La foto expiró. Actualiza el calendario.',403);
    assert(equals(sig,photoSign(s,id,size,exp)),'Foto no disponible.',403);const object=await env.BUCKET.get(`photos/${id}/${size}.webp`);assert(object,'Foto no encontrada.',404);
    return new Response(object.body,{headers:{...headers,'Content-Type':'image/webp','Cache-Control':'private, max-age=300'}});
  }
  if(path==='/api/auth'&&request.method==='POST'){
    const b=await body(request);assert(typeof b.token==='string'&&equals(hash(b.token),s.adminHash),'Este enlace de administración ya no está activo.',403);
    const value=token();await db.prepare('INSERT INTO sessions(hash,generation,expires) VALUES(?,?,?)').bind(hash(value),s.generation,Date.now()+43200000).run();
    ctx.waitUntil(db.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()).run());
    return json({ok:true},200,{'Set-Cookie':`ya_admin=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200; Secure`});
  }
  const sessionToken=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ya_admin='))?.slice(9);
  const session=sessionToken?await db.prepare('SELECT generation,expires FROM sessions WHERE hash=?').bind(hash(sessionToken)).first():null;
  const publicToken=request.headers.get('X-Calendar-Token');
  const isAdmin=s=>!!session&&session.generation===s.generation&&session.expires>Date.now();
  const authorize=(s,privateOnly=false)=>{const admin=isAdmin(s);assert(admin||(!privateOnly&&typeof publicToken==='string'&&equals(hash(publicToken),s.publicHash)),'Enlace inválido o sesión caducada. Abre tu enlace de acceso.',403);return admin;};
  const admin=authorize(s,path.startsWith('/api/admin/'));
  if(path==='/api/state'&&request.method==='GET'){const {s:current}=await transaction(db,env,current=>rules.reconcile(current));return json(snapshot(current,authorize(current)&&admin));}
  if(path==='/api/logout'&&request.method==='POST'){if(sessionToken)await db.prepare('DELETE FROM sessions WHERE hash=?').bind(hash(sessionToken)).run();return json({ok:true},200,{'Set-Cookie':'ya_admin=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0'});}
  if(path==='/api/admin/links'&&request.method==='GET')return json({publicPath:'/c/'+s.publicToken});
  if(path==='/api/admin/photo'&&request.method==='POST'){
    const b=await body(request,7100000);assert(b.consent===true,'Confirma el permiso para usar la fotografía.');const images=await processPhoto(b.data,b.focus),id=token().slice(0,24);
    await Promise.all(['full','thumb'].map(size=>env.BUCKET.put(`photos/${id}/${size}.webp`,images[size],{httpMetadata:{contentType:'image/webp'}})));
    return json({id,url:photoURL(s,id)});
  }
  const actions={'/api/draw':'draw','/api/complete':'complete','/api/reaction':'reaction','/api/admin/participant':'participant','/api/admin/config':'config','/api/admin/correction':'correction','/api/admin/rotate':'rotate'};
  if(actions[path]&&request.method==='POST'){
    const b=await body(request);if(actions[path]==='participant'&&b.photo)assert(typeof b.photo==='string'&&/^[A-Za-z0-9_-]{24}$/.test(b.photo)&&await env.BUCKET.head(`photos/${b.photo}/full.webp`),'Fotografía no encontrada.');
    const {out,s:current}=await transaction(db,env,current=>{authorize(current,path.startsWith('/api/admin/'));const out=rules.mutate(current,actions[path],b);if(actions[path]==='rotate'&&b.kind==='public')current.publicToken=out.token;return out;});
    if(actions[path]==='rotate'&&b.kind==='admin')ctx.waitUntil(db.prepare('DELETE FROM sessions WHERE generation<?').bind(current.generation).run());
    return json(out);
  }
  return json({error:'Operación no encontrada.'},404);
}
export default{
  async fetch(request,env,ctx){try{return await handle(request,env,ctx);}catch(err){if(!err.status)console.error('calendar_request_failed',{name:err.name});return json({error:err.status?err.message:'No se pudo guardar. Inténtalo de nuevo.'},err.status||500);}},
  async scheduled(event,env,ctx){const db=env.DB.withSession('first-primary');const rules=createRules();ctx.waitUntil(transaction(db,env,s=>rules.reconcile(s)));}
};
