export const config={api:{bodyParser:false}};
export default async function handler(req,res){
  try{
    const host=process.env.PUBLIC_ORIGIN||'https://'+(req.headers['x-forwarded-host']||req.headers.host);
    const path=req.url.startsWith('/api/calendar?')?new URL(req.url,host).searchParams.get('path')||'/':req.url;
    const headers=new Headers();for(const key of ['content-type','origin','cookie','x-calendar-token','accept']){const value=req.headers[key];if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);}
    headers.set('x-calendar-client-ip',String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||'unknown');
    const hasBody=!['GET','HEAD'].includes(req.method),chunks=[];let size=0;
    if(hasBody)for await(const chunk of req){size+=chunk.length;if(size>4000000){res.writeHead(413,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Reduce el tamaño de la foto antes de subirla.'}));}chunks.push(chunk);}
    const backend=process.env.CALENDAR_BACKEND_URL;
    if(!backend||!backend.startsWith('https://'))throw new Error('Calendar backend is not configured');
    console.info('calendar_proxy_start',{path:new URL(path,host).pathname,method:req.method});
    const response=await fetch(backend+path,{method:req.method,headers,...(hasBody?{body:Buffer.concat(chunks)}:{}),redirect:'manual',signal:AbortSignal.timeout(25000)});
    console.info('calendar_proxy_response',{status:response.status});
    const output={};for(const key of ['content-type','cache-control','set-cookie','referrer-policy','x-content-type-options','x-frame-options','x-robots-tag','content-security-policy'])if(response.headers.has(key))output[key]=response.headers.get(key);
    res.writeHead(response.status,output);res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error('calendar_unavailable',{name:error.name});if(!res.headersSent){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'El calendario no está disponible. Inténtalo de nuevo.'}));}}
}
