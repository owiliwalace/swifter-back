import {z} from 'zod';
import {authClient} from '../services/authService.js';
import {admin} from '../config/supabase.js';
import {setSession,clearSession,readCookie} from '../middlewares/session.js';
const credentials=z.object({email:z.email().max(254),password:z.string().min(8).max(128)});
const origin=()=>process.env.FRONTEND_URL||'http://localhost:5173';
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
 const {data,error}=await authClient().auth.signUp({email,password,options:{data:metadata,emailRedirectTo:origin()+'/login'}});
 if(error)return res.status(400).json({error:'Account creation could not be completed.'});
 if(data.session)setSession(res,data.session);
 res.status(201).json({authenticated:!!data.session,message:'Check your email to confirm your account, then sign in.'});
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
 const body=z.object({email:z.email().max(254)}).safeParse(req.body);
 if(!body.success)return res.status(400).json({error:'Enter a valid email.'});
 await authClient().auth.resetPasswordForEmail(body.data.email,{redirectTo:origin()+'/reset-password'});
 res.json({message:'If this account exists, check your email for a reset link.'});
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