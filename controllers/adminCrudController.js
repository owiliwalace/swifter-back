import {admin} from '../config/database.js';
import {adminCreateUserSchema,adminProfileSchema,catalogSchema} from '../validators/admin.js';
import {sendAuthEmail,emailConfig} from '../services/authMail.js';
import {frontendOrigin} from '../config/frontend.js';
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value||'');
async function audit(actor,action,target){
 const result=await admin.from('audit_logs').insert({user_id:actor,action,metadata:{target,operation:action}}).select('id').single();
 if(result.error)throw Object.assign(new Error('Audit unavailable'),{status:503});return result.data.id;
}
async function done(id,error){await admin.from('audit_logs').update({action:error?'admin.crud.failed':'admin.crud.completed'}).eq('id',id);}
export async function createUser(req,res){
 const body=adminCreateUserSchema.safeParse(req.body);if(!body.success)return res.status(400).json({error:'Enter a name, valid email and password of at least 8 characters.'});
 try{emailConfig();frontendOrigin();}catch{return res.status(503).json({error:'Configure account email delivery before creating users.'});}
 const event=await audit(req.user.id,'admin.user.create.requested',body.data.email);
 const {email,password,full_name}=body.data;
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:false,user_metadata:{full_name}});
 await done(event,error);if(error)return res.status(409).json({error:'Account could not be created. Check whether that email already exists.'});
 let warning;try{const link=await admin.auth.admin.generateLink({type:'magiclink',email,options:{redirectTo:frontendOrigin()+'/verify-email'}});if(link.error)throw new Error('Link generation failed');await sendAuthEmail({type:'magiclink',email,token:link.data.properties.hashed_token});}catch{warning='Account created, but confirmation email failed. Fix EmailJS settings and resend confirmation before the user can sign in.';}
 res.status(201).json({ok:true,id:data.user.id,warning});
}
export async function updateProfile(req,res){
 const body=adminProfileSchema.safeParse(req.body);if(!body.success||!uuid(req.params.id))return res.status(400).json({error:'Enter a valid account and display name.'});
 const event=await audit(req.user.id,'admin.profile.update.requested',req.params.id);
 const result=await admin.from('profiles').update(body.data).eq('id',req.params.id).select('id').single();await done(event,result.error);
 if(result.error)return res.status(409).json({error:'Profile update failed.'});res.json({ok:true});
}
export async function resendConfirmation(req,res){
 if(!uuid(req.params.id))return res.status(400).json({error:'Invalid account.'});
 const account=await admin.auth.admin.getUserById(req.params.id);
 if(account.error||account.data.user.email_confirmed_at)return res.status(409).json({error:'Account missing or email already confirmed.'});
 const event=await audit(req.user.id,'admin.confirmation.requested',req.params.id);
 const {data,error}=await admin.auth.admin.generateLink({type:'magiclink',email:account.data.user.email});
 if(error){await done(event,error);return res.status(503).json({error:'Confirmation link could not be generated.'});}
 try{await sendAuthEmail({type:'magiclink',email:account.data.user.email,token:data.properties.hashed_token});await done(event);res.json({ok:true});}
 catch{await done(event,true);res.status(503).json({error:'Confirmation email delivery failed. Check EmailJS settings.'});}
}
export async function deleteUser(req,res){
 const id=req.params.id;if(!uuid(id)||id===req.user.id)return res.status(400).json({error:'You cannot delete your own account.'});
 const account=await admin.auth.admin.getUserById(id);
 if(account.error)return res.status(404).json({error:'Account not found.'});
 if(typeof req.body?.confirm_email!=='string'||req.body.confirm_email!==account.data.user.email||!(Date.parse(account.data.user.banned_until)>Date.now()))return res.status(400).json({error:'Suspend the account first, then confirm its exact email address.'});
 const checks=await Promise.all(['deposits','withdrawals','trades','transactions','currency_wallets','influencers'].map(table=>admin.from(table).select('id',{count:'exact',head:true}).eq(table==='influencers'?'id':'user_id',id)));
 if(checks.some(result=>result.error))return res.status(503).json({error:'Account history could not be verified. No deletion was performed.'});
 if(checks.some(result=>result.count>0))return res.status(409).json({error:'This account has financial history. Keep it suspended to preserve its records.'});
 const event=await audit(req.user.id,'admin.user.delete.requested',id);
 // Disable authentication and retain linked records for audit.
 const result=await admin.auth.admin.deleteUser(id,true);await done(event,result.error);
 if(result.error)return res.status(409).json({error:'Account deletion failed.'});res.json({ok:true});
}
export async function saveMarket(req,res){
 const body=catalogSchema.safeParse(req.body);if(!body.success)return res.status(400).json({error:'Check the market ID, name and provider symbol.'});
 if(req.params.id&&req.params.id!==body.data.id)return res.status(400).json({error:'Market IDs cannot be changed.'});
 const event=await audit(req.user.id,'admin.market.save.requested',body.data.id);
 const result=req.params.id?await admin.from('markets').update(body.data).eq('id',req.params.id).select('id').single():await admin.from('markets').insert(body.data).select('id').single();await done(event,result.error);
 if(result.error)return res.status(409).json({error:'Market could not be saved. Check for a duplicate ID.'});res.json({ok:true});
}
export async function deleteMarket(req,res){
 const market=await admin.from('markets').select('id,name,is_active').eq('id',req.params.id).single();
 if(market.error||market.data.is_active||req.body?.confirm_id!==req.params.id)return res.status(400).json({error:'Disable the market and confirm its ID before deleting.'});
 const used=await admin.from('trades').select('id',{count:'exact',head:true}).in('market',[market.data.id,market.data.name]);
 if(used.error||used.count)return res.status(409).json({error:'Market has trading history or its history is unavailable. Keep it disabled.'});
 const event=await audit(req.user.id,'admin.market.delete.requested',req.params.id);
 const result=await admin.from('markets').delete().eq('id',req.params.id).eq('is_active',false).select('id').single();await done(event,result.error);
 if(result.error)return res.status(409).json({error:'Market deletion failed.'});res.json({ok:true});
}
