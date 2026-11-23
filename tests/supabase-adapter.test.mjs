import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseBindings} from '../hosted/supabase.mjs';
import {processPhoto} from '../hosted/images.mjs';
import sharp from 'sharp';

test('Supabase permite iniciar sesión cuando un INSERT correcto devuelve 201 sin cuerpo',async()=>{
  const writes=[];
  const {DB}=createSupabaseBindings({url:'https://example.supabase.co',key:'test-server-secret',fetcher:async(url,options)=>{
    writes.push({url,options});return new Response(null,{status:201});
  }});
  const result=await DB.prepare('INSERT INTO sessions(hash,generation,expires) VALUES(?,?,?)').bind('session-hash',1,Date.now()+43200000).run();
  assert.equal(result.meta.changes,1);
  assert.match(writes[0].url,/calendar_sessions$/);
  assert.equal(JSON.parse(writes[0].options.body).hash,'session-hash');
  await DB.prepare('INSERT OR IGNORE INTO app(id,body,revision) VALUES(1,?,1)').bind('{"version":1}').run();
});

test('Supabase rechaza escrituras obsoletas y conserva la revisión ganadora',async()=>{
  let row={body:'original',revision:1};
  const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url,options});assert.equal(options.headers.apikey,'test-server-secret');
    if(options.method==='PATCH'){
      const expected=Number(new URL(url).searchParams.get('revision').slice(3));
      if(expected!==row.revision)return Response.json([]);
      row=JSON.parse(options.body);return Response.json([row]);
    }
    return Response.json([row]);
  };
  const {DB}=createSupabaseBindings({url:'https://example.supabase.co',key:'test-server-secret',fetcher});
  const sql='UPDATE app SET body=?,revision=revision+1 WHERE id=1 AND revision=?';
  const first=await DB.prepare(sql).bind('ganador',1).run();
  const stale=await DB.prepare(sql).bind('perdedor',1).run();
  assert.equal(first.meta.changes,1);assert.equal(stale.meta.changes,0);
  assert.deepEqual(await DB.prepare('SELECT body,revision FROM app WHERE id=1').first(),{body:'ganador',revision:2});
  assert.ok(calls.every(c=>!c.url.includes('test-server-secret')));
});
test('Supabase conserva las fotos privadas y rechaza un fallo del almacenamiento',async()=>{
  const requests=[];const {BUCKET}=createSupabaseBindings({url:'https://example.supabase.co',key:'secret',fetcher:async(url,options)=>{requests.push({url,options});return new Response(null,{status:403});}});
  await assert.rejects(()=>BUCKET.put('photos/id/full.webp',new Uint8Array([1])),/write failed/);
  assert.match(requests[0].url,/storage\/v1\/object\/calendar-photos/);
  assert.equal(requests[0].options.headers['Content-Type'],'image/webp');
});
test('Vercel procesa JPG, PNG y WebP con tamaños y sin EXIF, y rechaza SVG',async()=>{
  for(const format of ['jpeg','png','webp']){
    const source=await sharp({create:{width:200,height:300,channels:3,background:'#24634e'}})[format]().toBuffer();
    const result=await processPhoto(source.toString('base64'),0);
    for(const[size,width]of [['full',256],['thumb',80]]){
      const meta=await sharp(result[size]).metadata();assert.equal(meta.width,width);assert.equal(meta.height,width);assert.equal(meta.format,'webp');assert.equal(meta.exif,undefined);
    }
  }
  await assert.rejects(()=>processPhoto(Buffer.from('<svg></svg>').toString('base64')),/válida|JPG/);
});
