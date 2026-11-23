// Server-only adapter. No service key is ever returned to the browser.
export function createSupabaseBindings({url,key,fetcher=fetch}){
  if(!url||!key)throw new Error('Faltan las variables privadas de Supabase.');
  const base=url.replace(/\/$/,'');
  const auth={apikey:key,Authorization:'Bearer '+key};
  async function rest(path,{method='GET',data,headers={}}={}){
    const response=await fetcher(base+'/rest/v1/'+path,{method,headers:{...auth,'Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Supabase database request failed: '+response.status);
    return response.status===204?null:response.json();
  }
  const encode=encodeURIComponent;
  class Statement{
    constructor(sql,args=[]){this.sql=sql;this.args=args;}
    bind(...args){return new Statement(this.sql,args);}
    async first(){const s=this.sql,a=this.args;
      if(s==='SELECT body,revision FROM app WHERE id=1')return(await rest('calendar_app?id=eq.1&select=body,revision'))[0]||null;
      if(s==='SELECT generation,expires FROM sessions WHERE hash=?')return(await rest('calendar_sessions?hash=eq.'+encode(a[0])+'&select=generation,expires'))[0]||null;
      if(s.startsWith('INSERT INTO rate_limits')){const hits=await rest('rpc/calendar_rate_limit',{method:'POST',data:{p_key:a[0],p_minute:a[1]}});return{hits};}
      throw new Error('Unsupported database read');
    }
    async run(){const s=this.sql,a=this.args;
      if(s.startsWith('INSERT OR IGNORE INTO app')){await rest('calendar_app?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},data:{id:1,body:a[0],revision:1}});return{meta:{changes:1}};}
      if(s.startsWith('UPDATE app SET body=')){const rows=await rest('calendar_app?id=eq.1&revision=eq.'+encode(a[1]),{method:'PATCH',headers:{Prefer:'return=representation'},data:{body:a[0],revision:a[1]+1}});return{meta:{changes:rows.length}};}
      if(s.startsWith('INSERT INTO sessions')){await rest('calendar_sessions',{method:'POST',data:{hash:a[0],generation:a[1],expires:a[2]}});return{meta:{changes:1}};}
      const deletions={
        'DELETE FROM sessions WHERE hash=?':['calendar_sessions','hash','eq'],
        'DELETE FROM sessions WHERE expires<?':['calendar_sessions','expires','lt'],
        'DELETE FROM sessions WHERE generation<?':['calendar_sessions','generation','lt'],
        'DELETE FROM rate_limits WHERE minute<?':['calendar_rate_limits','minute','lt']
      };
      if(deletions[s]){const[table,column,op]=deletions[s];await rest(`${table}?${column}=${op}.${encode(a[0])}`,{method:'DELETE'});return{meta:{changes:1}};}
      throw new Error('Unsupported database write');
    }
  }
  const DB={withSession(){return this;},prepare(sql){return new Statement(sql);}};
  const objectURL=path=>base+'/storage/v1/object/calendar-photos/'+path.split('/').map(encode).join('/');
  const BUCKET={
    async put(path,bytes){const res=await fetcher(objectURL(path),{method:'POST',headers:{...auth,'Content-Type':'image/webp','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(15000)});if(!res.ok)throw new Error('Photo storage write failed');},
    async get(path){const res=await fetcher(objectURL(path),{headers:auth,signal:AbortSignal.timeout(15000)});if(res.status===404)return null;if(!res.ok)throw new Error('Photo storage read failed');return{body:res.body};},
    async head(path){const res=await fetcher(objectURL(path),{method:'HEAD',headers:auth,signal:AbortSignal.timeout(15000)});if(res.status===404)return null;if(!res.ok)throw new Error('Photo storage lookup failed');return{};}
  };
  return{DB,BUCKET};
}
