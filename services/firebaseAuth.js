import {randomUUID,randomBytes} from 'node:crypto';
import {firebaseServices} from '../config/firebase.js';
import {now,result,failure,defaults} from './firestoreRepository.js';
export function publicUser(user){return {id:user.uid,email:user.email,app_metadata:user.customClaims||{},user_metadata:{full_name:user.displayName||''},email_confirmed_at:user.emailVerified?user.metadata.creationTime:null,banned_until:user.disabled?'9999-01-01T00:00:00.000Z':null,created_at:new Date(user.metadata.creationTime).toISOString(),last_sign_in_at:user.metadata.lastSignInTime?new Date(user.metadata.lastSignInTime).toISOString():null};}
export async function identityRequest(method,body){
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/'+method+'?key='+encodeURIComponent(process.env.FIREBASE_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await response.json();
 if(!response.ok)throw failure('Firebase authentication request failed',({'EMAIL_EXISTS':'email_exists','EMAIL_NOT_FOUND':'user_not_found','INVALID_LOGIN_CREDENTIALS':'invalid_credentials'}[data.error?.message]||'auth_failed'));
 return data;
}
const session=data=>({access_token:data.idToken||data.id_token,refresh_token:data.refreshToken||data.refresh_token,expires_in:Number(data.expiresIn||data.expires_in||3600)});
async function createAccount({email,password,email_confirm=false,user_metadata={},app_metadata={}}){
 const {auth,db}=firebaseServices();
 let user;
 try{user=await auth.createUser({uid:randomUUID(),email,password,emailVerified:email_confirm,displayName:user_metadata.full_name||''});}
 catch(error){throw failure('Unable to create account',error.code==='auth/email-already-exists'?'email_exists':error.code);}
 try{
  await auth.setCustomUserClaims(user.uid,{role:app_metadata.role==='admin'?'admin':'user'});
  await db.runTransaction(async tx=>{
   let attribution;
   if(user_metadata.referral_code){
    const code=user_metadata.referral_code.trim().toUpperCase();
    const matches=await tx.get(db.collection('influencers').where('code','==',code).where('enabled','==',true));
    if(matches.size!==1)throw failure('Invalid referral code');
    attribution={user_id:matches.docs[0].id,referred_user_id:user.uid,code};
   }
   tx.create(db.collection('profiles').doc(user.uid),defaults('profiles',{id:user.uid,full_name:user_metadata.full_name||'',country:user_metadata.country||null,phone:user_metadata.phone||null}));
   if(attribution)tx.create(db.collection('referrals').doc(user.uid),defaults('referrals',{id:user.uid,...attribution}));
  });
 }catch(error){await auth.deleteUser(user.uid);throw error;}
 return publicUser(await auth.getUser(user.uid));
}
export const firebaseAuthAdmin={
 async getUser(token){return result(async()=>{const {auth}=firebaseServices();const decoded=await auth.verifyIdToken(token,true);const user=await auth.getUser(decoded.uid);if(!user.emailVerified||user.disabled)throw failure('Account not confirmed');return {user:publicUser(user)};});},
 admin:{
  async createUser(args){return result(async()=>({user:await createAccount(args)}));},
  async getUserById(id){return result(async()=>({user:publicUser(await firebaseServices().auth.getUser(id))}));},
  async updateUserById(id,changes){return result(async()=>{
   const {auth}=firebaseServices();const update={};
   if(changes.password)update.password=changes.password;
   if(changes.email_confirm!==undefined)update.emailVerified=changes.email_confirm;
   if(changes.ban_duration!==undefined)update.disabled=changes.ban_duration!=='none';
   if(Object.keys(update).length)await auth.updateUser(id,update);
   if(changes.app_metadata)await auth.setCustomUserClaims(id,changes.app_metadata);
   if(changes.password||changes.ban_duration!==undefined||changes.app_metadata)await auth.revokeRefreshTokens(id);
   return {user:publicUser(await auth.getUser(id))};
  });},
  async deleteUser(id){return result(async()=>{await firebaseServices().auth.updateUser(id,{disabled:true});await firebaseServices().auth.revokeRefreshTokens(id);return {};});},
  async listUsers({page=1,perPage=25}={}){return result(async()=>{
   const {auth}=firebaseServices();let users=[],pageToken;
   do{const chunk=await auth.listUsers(1000,pageToken);users.push(...chunk.users);pageToken=chunk.pageToken;}while(pageToken);
   return {users:users.slice((page-1)*perPage,page*perPage).map(publicUser),total:users.length};
  });},
  async signOut(token){return result(async()=>{const {auth}=firebaseServices();const decoded=await auth.verifyIdToken(token);await auth.revokeRefreshTokens(decoded.uid);return {};});},
  async generateLink({type,email,password,options={}}){return result(async()=>{
   const {auth,db}=firebaseServices();let user;
   try{user=await auth.getUserByEmail(email);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
   if(type==='signup'){
    if(user){if(user.emailVerified)throw failure('Account exists','email_exists');}
    else{const created=await createAccount({email,password,user_metadata:options.data});user=await auth.getUser(created.id);}
   }
   if(!user)throw failure('No account','user_not_found');
   if(user.disabled)throw failure('Account disabled');
   const token=randomBytes(32).toString('hex');
   await db.collection('_auth_actions').doc(token).create({uid:user.uid,type,created_at:now(),expires_at:Date.now()+3600000,used:false});
   return {properties:{hashed_token:token}};
  });},
 }
};
export function firebaseAuthClient(){
 let tokens;
 return {auth:{
  async signInWithPassword(credentials){return result(async()=>{
   const data=await identityRequest('accounts:signInWithPassword',{...credentials,returnSecureToken:true});
   const user=await firebaseServices().auth.getUser(data.localId);
   if(!user.emailVerified||user.disabled)throw failure('Confirm your email before signing in');
   tokens=session(data);return {session:tokens,user:publicUser(user)};
  });},
  async refreshSession({refresh_token}){return result(async()=>{
   const response=await fetch('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(process.env.FIREBASE_API_KEY),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token}),signal:AbortSignal.timeout(15000)});
   const data=await response.json();if(!response.ok)throw failure('Session expired');
   await firebaseServices().auth.verifyIdToken(data.id_token,true);tokens=session(data);return {session:tokens};
  });},
  async verifyOtp({type,token_hash}){return result(async()=>{
   const {auth,db}=firebaseServices();
   const actionRef=db.collection('_auth_actions').doc(token_hash);
   const uid=await db.runTransaction(async tx=>{
    const action=await tx.get(actionRef);const value=action.data();
    if(!value||value.type!==type||value.used||value.expires_at<Date.now())throw failure('Expired or invalid link');
    const current=await auth.getUser(value.uid);if(current.disabled)throw failure('Account disabled');
    tx.update(actionRef,{used:true});return value.uid;
   });
   await auth.updateUser(uid,{emailVerified:true});
   if(type==='recovery')await auth.revokeRefreshTokens(uid);
   const data=await identityRequest('accounts:signInWithCustomToken',{token:await auth.createCustomToken(uid),returnSecureToken:true});
   tokens=session(data);return {session:tokens};
  });},
  async setSession(value){return result(async()=>{await firebaseServices().auth.verifyIdToken(value.access_token,true);tokens=value;return {session:value};});},
  async updateUser({password}){return result(async()=>{if(!tokens)throw failure('Session required');const {auth}=firebaseServices();const decoded=await auth.verifyIdToken(tokens.access_token,true);await auth.updateUser(decoded.uid,{password});await auth.revokeRefreshTokens(decoded.uid);return {};});},
  async signOut(){tokens=null;return {error:null};},
 }};
}
