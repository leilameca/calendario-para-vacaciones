import {Miniflare} from 'miniflare';
import {openCalendar} from '../lib/calendar.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const engine=openCalendar(':memory:');
const seed=engine.read(),keys=engine.initialLinks;engine.close();
const mf=new Miniflare({modules:true,scriptPath:resolve('dist/server/index.js'),modulesRules:[{type:'CompiledWasm',include:['**/*.wasm'],fallthrough:true}],compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{INITIAL_STATE_JSON:JSON.stringify(seed),INITIAL_PUBLIC_TOKEN:keys.publicToken}});
try{
  const db=await mf.getD1Database('DB');const sql=await readFile('drizzle/0000_cloud_calendar.sql','utf8');await db.exec(sql.replaceAll('--> statement-breakpoint',''));
  let cookie='';const origin='https://calendario.test';
  const call=async(path,data,admin=false)=>{const res=await mf.dispatchFetch(origin+'/api/'+path,{method:data?'POST':'GET',headers:{'X-Calendar-Token':keys.publicToken,...(data?{Origin:origin,'Content-Type':'application/json'}:{}),...(admin?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});return{res,body:await res.json()};};
  let result=await call('state');assert.equal(result.res.status,200);assert.equal(result.body.config.start,'2026-11-18');
  result=await call('admin/participant',{name:'Intruso'});assert.equal(result.res.status,403);
  result=await call('auth',{token:keys.adminToken});assert.equal(result.res.status,200);cookie=result.res.headers.get('Set-Cookie').split(';')[0];assert.match(result.res.headers.get('Set-Cookie'),/Secure/);
  for(const name of ['Ana','Luis','Mía'])assert.equal((await call('admin/participant',{name},true)).res.status,200);
  const state=(await call('state')).body,date=state.today;
  const draws=await Promise.all(Array.from({length:15},()=>call('draw',{date})));assert.ok(draws.every(r=>r.res.status===200),JSON.stringify(draws.map(r=>r.body)));
  const marks=await Promise.all(Array.from({length:15},()=>call('complete',{date})));assert.ok(marks.every(r=>r.res.status===200));
  let stored=JSON.parse((await db.prepare('SELECT body FROM app WHERE id=1').first()).body);assert.equal(stored.events.filter(e=>e.action==='Turno asignado').length,1);assert.equal(stored.events.filter(e=>e.action==='Día completado').length,1);
  for(const format of ['jpeg','png','webp']){const bytes=await sharp({create:{width:300,height:500,channels:3,background:'#24634e'}})[format]().toBuffer();result=await call('admin/photo',{data:bytes.toString('base64'),consent:true},true);assert.equal(result.res.status,200,JSON.stringify(result.body));const photo=await mf.dispatchFetch(origin+result.body.url);assert.equal(photo.status,200);const meta=await sharp(Buffer.from(await photo.arrayBuffer())).metadata();assert.equal(meta.width,256);assert.equal(meta.height,256);assert.equal(meta.format,'webp');}
  result=await call('admin/photo',{data:Buffer.from('<svg></svg>').toString('base64'),consent:true},true);assert.equal(result.res.status,400);
  result=await call('tick');assert.equal(result.body.ok,true);
  result=await call('admin/rotate',{kind:'admin'},true);assert.equal(result.res.status,200);assert.equal((await call('admin/links',null,true)).res.status,403);assert.equal((await call('auth',{token:keys.adminToken})).res.status,403);
  await mkdir('test-results',{recursive:true});await writeFile('test-results/worker-qa.json',JSON.stringify({ok:true,checks:['D1 persistence','Anonymous permission rejection','Secure admin cookie','15 concurrent draws','15 concurrent marks','JPG PNG WebP server recoding','Signed photos in R2','Invalid photo rejection','Automatic reconciliation','Admin session revocation']},null,2));console.log('Worker Cloudflare aprobado: D1, concurrencia, R2, fotos, permisos y accesos.');
}finally{await mf.dispose();}
