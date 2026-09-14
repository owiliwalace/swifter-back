import '../config/env.js';
import {admin} from '../config/supabase.js';
console.log('DATABASE_URL configured:',Boolean(process.env.DATABASE_URL));
for(const table of ['profiles','deposits','wallet_entries','trades','transactions']){
 const {error}=await admin.from(table).select('id').limit(1);
 console.log(table,error?error.code+': '+error.message:'available');
}
