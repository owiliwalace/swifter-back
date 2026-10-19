import '../config/env.js';
import {admin} from '../config/database.js';
console.log('Firebase configured:',Boolean(process.env.FIREBASE_PROJECT_ID));
const users=await admin.auth.admin.listUsers({page:1,perPage:1000});
console.log('Authentication users:',users.error?users.error.message:users.data.users.length);
const profile=await admin.from('profiles').select('id').limit(1);
console.log('Profile table:',profile.error?{code:profile.error.code,message:profile.error.message}:'available');
