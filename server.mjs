import http from 'node:http';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHmac,timingSafeEqual} from 'node:crypto';
import sharp from 'sharp';
import {openCalendar,hash,token,todayIn,dateRange,automatic,assert,AppError} from './lib/calendar.mjs';

const here=dirname(fileURLToPath(import.meta.url));
export async function createApp({dataDir=resolve(process.env.DATA_DIR||join(here,'.data')),now=()=>new Date(),secure=process.env.COOKIE_SECURE==='true'||!!process.env.PUBLIC_ORIGIN?.startsWith('https://'),origin=process.env.PUBLIC_ORIGIN}={}) {
  await mkdir(dataDir,{recursive:true});try{await chmod(dataDir,0o700);}catch{}
  const engine=openCalendar(join(dataDir,'calendar.sqlite'),{now});
  if(engine.initialLinks) {await writeFile(join(dataDir,'accesos.json'),JSON.stringify(engine.initialLinks,null,2),{mode:0o600});}
  const readLinks=async()=>JSON.parse(await readFile(join(dataDir,'accesos.json'),'utf8'));
  const limits=new Map();
  const timer=setInterval(()=>{try{engine.state();}catch(e){console.error('No se pudo reconciliar el calendario.');}const t=Date.now();for(const[k,v]of limits)if(t>v.reset)limits.delete(k);},15000);timer.unref();
  const sign=(s,id,size,exp)=>createHmac('sha256',s.photoSecret).update(`${id}:${size}:${exp}`).digest('base64url');
  const photoURL=(s,id,size='full')=>{if(!id)return null;const exp=Math.floor(Date.now()/1000)+900;return `/api/photo/${id}?size=${size}&exp=${exp}&sig=${sign(s,id,size,exp)}`;};
  const snapshot=(s,admin)=>{
    const today=todayIn(now()),range=dateRange(s.config.start,s.config.lastWork);
    const participants=s.participants.map(p=>({...p,photo:photoURL(s,p.photo,'thumb'),photoId:admin?p.photo:undefined,turns:Object.values(s.days).filter(d=>d.participantId===p.id && d.status==='completed').length,lastTurn:Object.values(s.days).filter(d=>d.participantId===p.id).map(d=>d.date).sort().at(-1)||null}));
    const mapDay=date=>{const d=s.days[date]||{date,status:date<today?'pending':'future',source:automatic(date,s.config)?'system':'human',reactions:{}};const counts={};for(const e of Object.values(d.reactions||{}))counts[e]=(counts[e]||0)+1;return {...d,photo:photoURL(s,d.photo),reactions:counts};};
    const days=range.map(mapDay);
    return {serverNow:now().toISOString(),today,version:s.version,config:s.config,participants:admin?participants:participants.filter(p=>p.active),days,archived:admin?Object.keys(s.days).filter(d=>!range.includes(d)).sort().map(mapDay):[],events:admin?s.events.slice(-300).reverse():undefined,admin,remainingTurns:days.filter(d=>d.source==='human'&&!['completed','omitted'].includes(d.status)).length};
  };
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('X-Robots-Tag','noindex, nofollow');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; media-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
    try {
      const url=new URL(req.url,'http://localhost'),path=url.pathname;
      if(!path.startsWith('/api/')) {
        if(path==='/' && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !origin){const links=await readLinks();res.writeHead(302,{Location:'/c/'+links.publicToken});return res.end();}
        const assets={'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/favicon.svg':['favicon.svg','image/svg+xml']};
        if(assets[path]){const [file,type]=assets[path];res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});return res.end(await readFile(join(here,'public',file)));}
        if(path==='/admin/' || /^\/c\/[A-Za-z0-9_-]{43}$/.test(path)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(await readFile(join(here,'public/index.html')));}
        return reply(404,{error:'Enlace no encontrado.'});
      }
      if(req.method!=='GET') {
        const expected=origin||`http://${req.headers.host}`;
        assert(req.headers.origin===expected,'Solicitud desde un origen no permitido.',403);
        const key=req.socket.remoteAddress+':'+(path.includes('/auth')?'auth':'write'),t=Date.now(),v=limits.get(key)||{n:0,reset:t+60000};if(t>v.reset){v.n=0;v.reset=t+60000;}v.n++;limits.set(key,v);assert(v.n<=(path.includes('/auth')?20:120),'Demasiadas solicitudes. Espera un minuto.',429);
      }
      let s=engine.read();
      if(path.startsWith('/api/photo/') && req.method==='GET') {
        const id=path.split('/').at(-1),size=url.searchParams.get('size'),exp=Number(url.searchParams.get('exp')),sig=url.searchParams.get('sig')||'';
        assert(['full','thumb'].includes(size) && exp>=Date.now()/1000 && exp<=Date.now()/1000+1800,'La foto expiró. Actualiza el calendario.',403);
        const correct=sign(s,id,size,exp);assert(sig.length===correct.length && timingSafeEqual(Buffer.from(sig),Buffer.from(correct)),'Foto no disponible.',403);
        const p=engine.db.prepare('SELECT full,thumb FROM photos WHERE id=?').get(id);assert(p,'Foto no encontrada.',404);res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private, max-age=300'});return res.end(Buffer.from(p[size]));
      }
      let sessionToken=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ya_admin='))?.slice(9);
      const session=sessionToken?engine.db.prepare('SELECT * FROM sessions WHERE hash=?').get(hash(sessionToken)):null;
      const admin=!!session && session.generation===s.generation && session.expires>Date.now();
      const publicToken=req.headers['x-calendar-token'];const publicOK=typeof publicToken==='string'&&hash(publicToken)===s.publicHash;
      async function body(max=100000) {let length=0;const chunks=[];for await(const b of req){length+=b.length;assert(length<=max,'El archivo supera el tamaño permitido.',413);chunks.push(b);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw new AppError('Datos inválidos.');}}
      if(path==='/api/auth' && req.method==='POST') {const b=await body();assert(typeof b.token==='string'&&hash(b.token)===s.adminHash,'Este enlace de administración ya no está activo.',403);const value=token();engine.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());engine.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(value),s.generation,Date.now()+12*3600000);res.setHeader('Set-Cookie',`ya_admin=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure?'; Secure':''}`);return reply(200,{ok:true});}
      assert(admin||publicOK,'Enlace inválido o sesión caducada. Abre tu enlace de acceso.',403);
      if(path==='/api/state' && req.method==='GET'){return reply(200,snapshot(engine.state(),admin));}
      if(path==='/api/logout' && req.method==='POST') {if(sessionToken)engine.db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(sessionToken));res.setHeader('Set-Cookie','ya_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return reply(200,{ok:true});}
      if(path==='/api/admin/links' && req.method==='GET'){assert(admin,'Acceso privado requerido.',403);const l=await readLinks();return reply(200,{publicPath:'/c/'+l.publicToken});}
      if(path==='/api/admin/photo' && req.method==='POST') {
        assert(admin,'Acceso privado requerido.',403);const b=await body(7100000);assert(b.consent===true,'Confirma el permiso para usar la fotografía.');assert(typeof b.data==='string','Elige una fotografía.');const buf=Buffer.from(b.data,'base64');assert(buf.length<=5*1024*1024,'La fotografía supera los 5 MB.');
        let image,meta;try{image=sharp(buf,{limitInputPixels:25000000,animated:false});meta=await image.metadata();}catch{throw new AppError('El archivo no es una imagen válida.');}
        assert(['jpeg','png','webp'].includes(meta.format) && !(meta.pages>1),'Usa una foto JPG, PNG o WebP sin animación.');
        const focus=Math.min(1,Math.max(0,Number(b.focus)||0.5));
        const oriented=await image.rotate().toBuffer({resolveWithObject:true});const side=Math.min(oriented.info.width,oriented.info.height);
        const square=sharp(oriented.data).extract({left:Math.round((oriented.info.width-side)*focus),top:Math.round((oriented.info.height-side)*focus),width:side,height:side});
        const full=await square.clone().resize(256,256).webp({quality:82}).toBuffer(),thumb=await square.clone().resize(80,80).webp({quality:78}).toBuffer(),id=token().slice(0,24);
        engine.db.prepare('INSERT INTO photos VALUES(?,?,?)').run(id,full,thumb);return reply(200,{id,url:photoURL(s,id)});
      }
      const actions={'/api/draw':'draw','/api/complete':'complete','/api/reaction':'reaction','/api/admin/participant':'participant','/api/admin/config':'config','/api/admin/correction':'correction','/api/admin/rotate':'rotate'};
      if(actions[path] && req.method==='POST') {
        if(path.startsWith('/api/admin/'))assert(admin,'Acceso privado requerido.',403);
        const b=await body();
        if(path.endsWith('/participant') && b.photo) assert(engine.db.prepare('SELECT id FROM photos WHERE id=?').get(b.photo),'Fotografía no encontrada.');
        const out=engine.mutate(actions[path],b);
        if(actions[path]==='rotate') {const l=await readLinks();l[b.kind+'Token']=out.token;await writeFile(join(dataDir,'accesos.json'),JSON.stringify(l,null,2),{mode:0o600});}
        if(actions[path]==='participant') {const state=engine.read();const keep=new Set([...state.participants.map(p=>p.photo),...Object.values(state.days).map(d=>d.photo)].filter(Boolean));for(const row of engine.db.prepare('SELECT id FROM photos').all())if(!keep.has(row.id))engine.db.prepare('DELETE FROM photos WHERE id=?').run(row.id);}
        return reply(200,out);
      }
      return reply(404,{error:'Operación no encontrada.'});
    }catch(e){reply(e.status||500,{error:e.status?e.message:'No se pudo guardar. Inténtalo de nuevo.'});}
  });
  server.on('close',()=>{clearInterval(timer);engine.close();});
  return {server,engine,readLinks};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const app=await createApp(),port=Number(process.env.PORT||3100),host=process.env.HOST||'127.0.0.1';
  app.server.listen(port,host,()=>console.log(`Ya casi está listo en http://${host}:${port}\nLos accesos privados están en .data/accesos.json. No compartas ese archivo.`));
}
