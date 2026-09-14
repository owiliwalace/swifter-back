import {createClient} from '@supabase/supabase-js';
import '../config/env.js';
export function authClient(){
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_ANON_KEY){const error=new Error('Account service is not configured.');error.status=503;throw error;}
 return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}