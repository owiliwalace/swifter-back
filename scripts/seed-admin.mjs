import {admin} from '../config/database.js';
import {authClient} from '../services/authService.js';

// Supply JSON on stdin, or ADMIN_EMAIL / ADMIN_PASSWORD in the process environment.
// Credentials are never stored in this script or printed.
try {
 let input='';
 if(!process.stdin.isTTY)for await(const chunk of process.stdin)input+=chunk;
 const supplied=input.trim()?JSON.parse(input):{};
 const email=String(supplied.email||process.env.ADMIN_EMAIL||'').trim().toLowerCase();
 const password=supplied.password||process.env.ADMIN_PASSWORD;
 if(!admin||!email.includes('@')||typeof password!=='string'||password.length<8)throw new Error('Supply a valid email, password and Firebase configuration.');
 const schema=await admin.from('profiles').select('id').limit(0);
 if(schema.error)throw new Error('Initialize Firestore before seeding.');
 let existing;
 for(let page=1;;page++){
  const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});
  if(error)throw new Error('Account lookup failed.');
  existing=data.users.find(user=>user.email?.toLowerCase()===email);
  if(existing||data.users.length<100)break;
 }
 const result=existing
  ? await admin.auth.admin.updateUserById(existing.id,{password,email_confirm:true,app_metadata:{...existing.app_metadata,role:'admin'}})
  : await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role:'admin'},user_metadata:{full_name:'SwiftTrade Admin'}});
 if(result.error)throw new Error('Administrator account could not be saved.');
 const profile=await admin.from('profiles').select('id').eq('id',result.data.user.id).single();
 if(profile.error)throw new Error('Administrator saved, but its profile is missing.');
 const client=authClient();
 const login=await client.auth.signInWithPassword({email,password});
 if(login.error||login.data.user?.app_metadata?.role!=='admin')throw new Error('Administrator saved, but login verification failed.');
 await client.auth.signOut();
 console.log('Administrator seeded; confirmed email, profile and password login verified.');
}catch(error){console.error(error.message);process.exitCode=1;}
