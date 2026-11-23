import app from '../worker/index.mjs';
import {createSupabaseBindings} from './supabase.mjs';
export async function handleVercel(request,env,ctx){
  const bindings=createSupabaseBindings({url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY});
  return app.fetch(request,{...bindings,INITIAL_STATE_JSON:env.INITIAL_STATE_JSON,INITIAL_PUBLIC_TOKEN:env.INITIAL_PUBLIC_TOKEN},ctx);
}
