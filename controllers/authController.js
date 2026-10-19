import {z} from 'zod';
import {authClient} from '../services/authService.js';
import {admin} from '../config/database.js';
import {setSession,clearSession,readCookie} from '../middlewares/session.js';
import {signupFailure} from '../services/signupErrors.js';
import {frontendOrigin} from '../config/frontend.js';
import {emailConfig,sendAuthEmail} from '../services/authMail.js';
const credentials=z.object({email:z.email().max(254),password:z.string().min(8).max(128)});
const origin=()=>frontendOrigin();
export async function login(req,res){
 const body=credentials.safeParse(req.body);if(!body.success)return res.status(400).json({error:'Enter a valid email and password.'});
 const {data,error}=await authClient().auth.signInWithPassword(body.data);
 if(error||!data.session)return res.status(401).json({error:'Incorrect credentials or unconfirmed account.'});
 setSession(res,data.session);res.json({authenticated:true});
}
export async function signup(req,res){
 const body=credentials.extend({full_name:z.string().trim().min(1).max(120),country:z.string().max(4).optional(),phone:z.string().max(30).optional(),referral_code:z.string().max(80).optional(),agreed:z.literal(true)}).strict().safeParse(req.body);
 if(!body.success)return res.status(400).json({error:'Check your details, password length and terms acceptance.'});
 const {email,password,...metadata}=body.data;
 if(!admin)return res.status(503).json({error:'Account service is not configured.'});
 if(metadata.referral_code?.trim()){
  metadata.referral_code=metadata.referral_code.trim().toUpperCase();
  const lookup=await admin.from('influencers').select('id').eq('code',metadata.referral_code).eq('enabled',true).maybeSingle();
  if(lookup.error)return res.status(503).json({error:'Referral validation is temporarily unavailable.'});
  if(!lookup.data)return res.status(400).json({error:'This referral code is not active.'});
 }
 try{emailConfig();origin();}catch{return res.status(503).json({error:'Account email delivery is not configured. Contact the site operator.'});}
 if(!admin)return res.status(503).json({error:'Account service is not configured.'});
 const {data,error}=await admin.auth.admin.generateLink({type:'signup',email,password,options:{data:metadata,redirectTo:origin()+'/verify-email'}});
 if(error){
  const failure=signupFailure(error);
  // Log diagnostic codes only; never email addresses, passwords or provider messages.
  console.error('Signup failed',{code:failure.code,providerCode:/^[a-z_]{1,80}$/.test(error.code||'')?error.code:'unknown',status:failure.status});
  return res.status(failure.status).json({error:failure.message,code:failure.code});
 }
 try{await sendAuthEmail({type:'signup',email,token:data.properties.hashed_token});}
 catch{console.error('Signup email delivery failed');return res.status(503).json({error:'The confirmation email could not be sent. Please try again later or contact support.'});}
 res.status(201).json({authenticated:false,message:'Check your email to confirm your account.'});
}
export async function refresh(req,res){
 const token=readCookie(req,'swift_refresh');if(!token)return res.status(401).json({error:'Please sign in.'});
 const {data,error}=await authClient().auth.refreshSession({refresh_token:token});
 if(error||!data.session){clearSession(res);return res.status(401).json({error:'Session expired.'});}
 setSession(res,data.session);res.json({authenticated:true});
}
export async function logout(req,res){
 const token=readCookie(req,'swift_access');
 if(token&&admin)await admin.auth.admin.signOut(token,'local').catch(()=>{});
 clearSession(res);res.json({ok:true});
}
export async function forgotPassword(req,res){
 const body=z.object({email:z.string().trim().toLowerCase().email().max(254)}).strict().safeParse(req.body);
 if(!body.success)return res.status(400).json({error:'Enter a valid email.'});
 try{emailConfig();origin();}catch{return res.status(503).json({error:'Account email delivery is not configured. Contact the site operator.'});}
 if(!admin)return res.status(503).json({error:'Account service is not configured.'});
 const {data,error}=await admin.auth.admin.generateLink({type:'recovery',email:body.data.email,options:{redirectTo:origin()+'/verify-email'}});
 if(error&&error.code!=='user_not_found')return res.status(503).json({error:'Password recovery is temporarily unavailable.'});
 if(!error){try{await sendAuthEmail({type:'recovery',email:body.data.email,token:data.properties.hashed_token});}catch{console.error('Recovery email delivery failed');return res.status(503).json({error:'Password recovery email could not be sent. Please try again later.'});}}
 res.json({message:'If this account exists, check your email for a reset link.'});
}
export async function verifyEmail(req,res){
 const body=z.object({type:z.enum(['signup','recovery','magiclink']),token_hash:z.string().min(32).max(256).regex(/^[a-zA-Z0-9_-]+$/)}).strict().safeParse(req.body);
 if(!body.success)return res.status(400).json({error:'Invalid confirmation link.'});
 const {data,error}=await authClient().auth.verifyOtp(body.data);
 if(error||!data.session)return res.status(400).json({error:'This link is invalid or expired. Please request a new one.'});
 setSession(res,data.session);res.json({ok:true,type:body.data.type});
}
export async function recoverySession(req,res){
 const body=z.object({access_token:z.string().min(10).max(8192),refresh_token:z.string().min(10).max(8192)}).strict().safeParse(req.body);
 if(!body.success)return res.status(400).json({error:'Invalid recovery link.'});
 const {data,error}=await authClient().auth.setSession(body.data);
 if(error||!data.session)return res.status(401).json({error:'Recovery link is invalid or expired.'});
 setSession(res,data.session);res.json({ok:true});
}
export async function resetPassword(req,res){
 const body=z.object({password:z.string().min(8).max(128)}).strict().safeParse(req.body);
 if(!body.success)return res.status(400).json({error:'Use 8 to 128 characters.'});
 const client=authClient();
 const session=await client.auth.setSession({access_token:req.accessToken,refresh_token:readCookie(req,'swift_refresh')||''});
 if(session.error)return res.status(401).json({error:'Request a new recovery link.'});
 const {error}=await client.auth.updateUser({password:body.data.password});
 if(error)return res.status(400).json({error:'Password update failed.'});
 await client.auth.signOut();clearSession(res);res.json({message:'Password updated. Please sign in.'});
}
