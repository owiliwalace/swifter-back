import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {app} from '../app.js';
import {admin} from '../config/database.js';
import {firebaseServices} from '../config/firebase.js';
const {auth,db}=firebaseServices();
const email='firebase-smoke-'+randomUUID()+'@example.com',password=randomBytes(24).toString('base64url');
let id,actionToken,cookie='',server;
try{
 const created=await admin.auth.admin.generateLink({type:'signup',email,password,options:{data:{full_name:'Temporary Firebase verification test'}}});
 if(created.error)throw new Error('Temporary account setup: '+created.error.code);
 actionToken=created.data.properties.hashed_token;id=(await auth.getUserByEmail(email)).uid;
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api';
 const request=async(path,body)=>fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 let response=await request('/auth/login',{email,password});assert.equal(response.status,401,'Unverified accounts must not log in');
 response=await request('/auth/verify-email',{type:'signup',token_hash:actionToken});assert.equal(response.status,200,'Email token exchange');
 cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 response=await request('/auth/verify-email',{type:'signup',token_hash:actionToken});assert.equal(response.status,400,'Email link cannot be reused');
 for(const endpoint of ['/me','/wallets','/payments/deposits','/referrals','/withdrawals','/notifications','/support/messages']){
  response=await request(endpoint);assert.equal(response.status,200,endpoint);console.log('Verified Firebase API:',endpoint);
 }
 response=await request('/admin/overview');assert.equal(response.status,403,'Users cannot access admin');
 await auth.setCustomUserClaims(id,{role:'admin'});
 for(const endpoint of ['/admin/users','/admin/users/'+id,'/admin/finance/settings','/admin/system','/admin/overview']){
  response=await request(endpoint);assert.equal(response.status,200,endpoint);console.log('Verified Firebase admin API:',endpoint);
 }
 response=await request('/wallets',{currency:'BTC'});assert.equal(response.status,200,'Open zero balance wallet');
 response=await request('/wallets');const wallet=await response.json();assert.equal(wallet.wallets.find(row=>row.currency==='BTC').balance,'0');
 response=await request('/auth/login',{email,password});assert.equal(response.status,200,'Verified account password login');
 cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 const recovery=await admin.auth.admin.generateLink({type:'recovery',email});
 if(recovery.error)throw new Error('Recovery setup failed');
 const recoveryToken=recovery.data.properties.hashed_token;
 try{
  response=await request('/auth/verify-email',{type:'signup',token_hash:recoveryToken});assert.equal(response.status,400,'Recovery token cannot confirm signup');
  response=await request('/auth/verify-email',{type:'recovery',token_hash:recoveryToken});assert.equal(response.status,200,'Recovery token verification');
  cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  const newPassword=randomBytes(24).toString('base64url');
  response=await request('/auth/reset-password',{password:newPassword});assert.equal(response.status,200,'Recovery password reset');
  response=await request('/auth/login',{email,password});assert.equal(response.status,401,'Old password invalidated');
  response=await request('/auth/login',{email,password:newPassword});assert.equal(response.status,200,'New password works');
 }finally{await db.collection('_auth_actions').doc(recoveryToken).delete();}
 console.log('Firebase verification, password login, account/admin APIs, wallets and password recovery passed. No email sent by this test.');
}catch(error){console.error('Firebase smoke test failed:',error.code||error.message);process.exitCode=1;}
finally{
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 if(id){
  for(const table of ['currency_wallets','referrals']){
   const snapshot=await db.collection(table).where(table==='referrals'?'referred_user_id':'user_id','==',id).get();
   for(const doc of snapshot.docs)await doc.ref.delete();
  }
  await db.collection('profiles').doc(id).delete();
  await auth.deleteUser(id);
 }
 if(actionToken)await db.collection('_auth_actions').doc(actionToken).delete();
 await db.terminate();
 console.log('Temporary Firebase smoke test records cleaned up.');
}
