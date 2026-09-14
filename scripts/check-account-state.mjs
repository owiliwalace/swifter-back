import '../config/env.js';
import {admin} from '../config/supabase.js';
console.log('Direct migration connection configured:',Boolean(process.env.DATABASE_URL));
const users=await admin.auth.admin.listUsers({page:1,perPage:1000});
console.log('Authentication users:',users.error?users.error.message:users.data.users.length);
const profile=await admin.from('profiles').select('id').limit(1);
console.log('Profile table:',profile.error?{code:profile.error.code,message:profile.error.message}:'available');
