import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import handler from '../api/calendar.mjs';

test('el proxy conserva ruta, origen y cookie sin reenviar cabeceras internas',async()=>{
  const originalFetch=globalThis.fetch,oldBackend=process.env.CALENDAR_BACKEND_URL,oldOrigin=process.env.PUBLIC_ORIGIN;
  process.env.CALENDAR_BACKEND_URL='https://test.supabase.co/functions/v1/calendar-api';process.env.PUBLIC_ORIGIN='https://calendar.example';
  let captured;
  globalThis.fetch=async(url,options)=>{captured={url,options};return new Response('{"ok":true}',{status:200,headers:{'Content-Type':'application/json','Set-Cookie':'ya_admin=test; HttpOnly; Secure','Content-Length':'999','Content-Encoding':'gzip'}});};
  try{
    const req=Readable.from([Buffer.from('{"token":"test"}')]);req.method='POST';req.url='/api/auth';req.headers={host:'calendar.example',origin:'https://calendar.example','content-type':'application/json',cookie:'existing=test','x-forwarded-for':'192.0.2.1','x-vercel-secret':'must-not-forward',connection:'keep-alive'};
    const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};
    await handler(req,res);
    assert.equal(captured.url,'https://test.supabase.co/functions/v1/calendar-api/api/auth');
    assert.equal(captured.options.headers.get('Origin'),'https://calendar.example');
    assert.equal(captured.options.headers.get('Cookie'),'existing=test');
    assert.equal(captured.options.headers.get('x-vercel-secret'),null);
    assert.equal(captured.options.headers.get('connection'),null);
    assert.equal(captured.options.body.toString(),'{"token":"test"}');
    assert.equal(res.status,200);assert.equal(res.headers['content-length'],undefined);assert.equal(res.headers['content-encoding'],undefined);assert.match(res.headers['set-cookie'],/HttpOnly/);assert.equal(res.body.toString(),'{"ok":true}');
  }finally{globalThis.fetch=originalFetch;if(oldBackend===undefined)delete process.env.CALENDAR_BACKEND_URL;else process.env.CALENDAR_BACKEND_URL=oldBackend;if(oldOrigin===undefined)delete process.env.PUBLIC_ORIGIN;else process.env.PUBLIC_ORIGIN=oldOrigin;}
});
