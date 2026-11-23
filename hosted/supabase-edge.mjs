import app from '../worker/index.mjs';
import {createSupabaseBindings} from './supabase.mjs';

// Database credentials stay inside Supabase's built-in function environment.
// Public callers still need the calendar capability or a valid admin session.
const publicOrigin='https://ya-casi-calendario.vercel.app';
Deno.serve(async request=>{
  const url=new URL(request.url),prefix='/calendar-api',index=url.pathname.indexOf(prefix);
  const path=index>=0?url.pathname.slice(index+prefix.length):url.pathname;
  if(!path.startsWith('/api/'))return new Response('Not found',{status:404});
  const headers=new Headers(request.headers);
  headers.set('CF-Connecting-IP',request.headers.get('x-calendar-client-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown');
  const internal=new Request(publicOrigin+path+url.search,{method:request.method,headers,...(!['GET','HEAD'].includes(request.method)?{body:request.body,duplex:'half'}:{})});
  const bindings=createSupabaseBindings({url:Deno.env.get('SUPABASE_URL'),key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')});
  return app.fetch(internal,bindings,{waitUntil(promise){EdgeRuntime.waitUntil(promise);}});
});
