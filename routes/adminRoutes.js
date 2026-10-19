import {Router} from 'express';
import {admin} from '../config/database.js';
import {requireUser} from '../middlewares/auth.js';
import {requireAdmin} from '../middlewares/admin.js';
import {adminActionSchema} from '../validators/admin.js';
import {emailConfig} from '../services/authMail.js';
import {createUser,updateProfile,resendConfirmation,deleteUser,saveMarket,deleteMarket} from '../controllers/adminCrudController.js';
import {getFinanceSettings,setFinanceSettings,setInfluencer,reviewWithdrawal,reconcileDeposit} from '../controllers/financeController.js';
const resources = {
 profiles:'id,full_name,balance,currency,wallet_kes,created_at',
 deposits:'id,user_id,amount,currency,channel,status,environment,receipt,reference,created_at',
 withdrawals:'id,user_id,provider_id,currency,amount,source,reserved,destination,status,provider_reference,review_note,created_at',
 influencers:'id,code,enabled,rate,available_kes,earned_kes,created_at',
 referral_commissions:'id,user_id,referred_user_id,deposit_id,deposit_amount,rate,amount,currency,created_at',
 wallet_entries:'id,user_id,deposit_id,amount,currency,created_at',
 currency_wallets:'id,user_id,currency,balance,created_at',
 transactions:'id,user_id,type,amount,currency,created_at',
 trades:'id,user_id,market,contract,stake,payout,status,account_mode,currency,created_at',
 bot_strategies:'id,user_id,name,created_at',
 bot_runs:'id,user_id,strategy_id,account_mode,status,created_at',
 scanner_runs:'id,user_id,category,status,created_at',
 support_conversations:'id,user_id,subject,status,created_at',
 support_messages:'id,user_id,conversation_id,sender_role,message,created_at',
 notifications:'id,user_id,title,read_at,created_at',
 referrals:'id,user_id,referred_user_id,code,created_at',
 documents:'id,user_id,mime_type,size_bytes,status,created_at',
 audit_logs:'id,user_id,action,created_at',
 webhook_events:'id,provider_id,event_id,status,created_at',
 payment_providers:'id,name,enabled,supported_currencies,created_at',
 markets:'id,name,provider_symbol,is_active,created_at',
 site_files:'id,mime_type,size_bytes,created_at'
};
export const adminRoutes=Router();
adminRoutes.use(requireUser,requireAdmin);
adminRoutes.post('/users',createUser);
adminRoutes.post('/users/:id/profile',updateProfile);
adminRoutes.post('/users/:id/confirmation',resendConfirmation);
adminRoutes.post('/users/:id/delete',deleteUser);
adminRoutes.post('/catalog/markets',saveMarket);
adminRoutes.post('/catalog/markets/:id',saveMarket);
adminRoutes.post('/catalog/markets/:id/delete',deleteMarket);
adminRoutes.get('/finance/settings',getFinanceSettings);
adminRoutes.post('/finance/settings',setFinanceSettings);
adminRoutes.post('/finance/influencers',setInfluencer);
adminRoutes.post('/finance/withdrawals/:id',reviewWithdrawal);
adminRoutes.post('/finance/deposits/:id',reconcileDeposit);
adminRoutes.get('/users',async(req,res)=>{
 const page=Number(req.query.page??1);
 if(!Number.isSafeInteger(page)||page<1||page>100000)return res.status(400).json({error:'Invalid page.'});
 const search=String(req.query.search||'').trim();if(search.length>254)return res.status(400).json({error:'Search is too long.'});
 const directory=await admin.rpc('admin_user_directory',{p_actor:req.user.id,p_search:search,p_page:page});
 if(!directory.error)return res.json(directory.data);
 if(directory.error.code!=='PGRST202')return res.status(503).json({error:'User directory unavailable.'});
 if(search)return res.status(503).json({error:'User search is temporarily unavailable.'});
 const {data,error}=await admin.auth.admin.listUsers({page,perPage:25});
 if(error)return res.status(503).json({error:'User directory unavailable.'});
 res.set('Cache-Control','no-store').json({rows:data.users.map(user=>({id:user.id,email:user.email,role:user.app_metadata?.role||'user',suspended:Date.parse(user.banned_until)>Date.now(),created_at:user.created_at})),total:data.total,page,page_size:25});
});
adminRoutes.get('/users/:id',async(req,res)=>{
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(req.params.id))return res.status(400).json({error:'Invalid account ID.'});
 const id=req.params.id;
 const account=await admin.auth.admin.getUserById(id);if(account.error)return res.status(404).json({error:'Account not found.'});
 const results=await Promise.all([
  admin.from('profiles').select('id,full_name,currency,wallet_kes,balance,payment_reference,created_at').eq('id',id).maybeSingle(),
  admin.from('deposits').select('id,amount,currency,status,channel,created_at').eq('user_id',id).order('created_at',{ascending:false}).limit(10),
  admin.from('withdrawals').select('id,amount,currency,status,created_at').eq('user_id',id).order('created_at',{ascending:false}).limit(10),
  admin.from('influencers').select('code,enabled,rate,available_kes,earned_kes').eq('id',id).maybeSingle()
 ]);
 const user=account.data.user;
 res.json({user:{id:user.id,email:user.email,email_confirmed:!!user.email_confirmed_at,role:user.app_metadata?.role||'user',suspended:Date.parse(user.banned_until)>Date.now(),last_sign_in_at:user.last_sign_in_at,created_at:user.created_at},profile:results[0].data,deposits:results[1].data||[],withdrawals:results[2].data||[],influencer:results[3].data,unavailable:results.flatMap((result,i)=>result.error?[['profile','deposits','withdrawals','influencer'][i]]:[])});
});
adminRoutes.get('/system',async(_req,res)=>{
 let emailReady=false;try{emailConfig();emailReady=true;}catch{/* Report configuration only, not credentials. */}
 const finance=await admin.from('referral_settings').select('enabled,rate,min_withdrawal').eq('id',true).maybeSingle();
 res.json({services:[{name:'Accounts',status:'Firebase Authentication connected'},{name:'Referral finance',status:finance.error?'Firestore unavailable':finance.data?.enabled?'Enabled':'Configured; program paused'},{name:'Account email',status:emailReady?'EmailJS configured; delivery must be verified':'EmailJS settings incomplete'},{name:'Market scanner',status:'Deriv public market data; availability checked on each scan'},{name:'Trade execution',status:'Broker account authorization not connected'},{name:'Crypto payments',status:'Provider integration required'},{name:'Withdrawals',status:'Manual payout review'}]});
});
adminRoutes.post('/actions/:id',async(req,res)=>{
 const parsed=adminActionSchema.safeParse(req.body);
 if(!parsed.success||!/^[a-zA-Z0-9_-]{1,80}$/.test(req.params.id))return res.status(400).json({error:'Invalid admin action.'});
 const body=parsed.data,id=req.params.id;
 if(body.action==='withdrawal')return res.status(400).json({error:'Use the finance withdrawal review workflow.'});
 if(id===req.user.id&&['role','suspend'].includes(body.action))return res.status(400).json({error:'Use another administrator to change your own access.'});
 // Record intent before changing any account or operational state.
 const audit=await admin.from('audit_logs').insert({user_id:req.user.id,action:'admin.'+body.action+'.requested',metadata:{target:id,...body}}).select('id').single();
 if(audit.error)return res.status(503).json({error:'Audit logging unavailable; no change was made.'});
 let result;
 if(body.action==='role'||body.action==='suspend'){
  const current=await admin.auth.admin.getUserById(id);
  if(current.error)return res.status(404).json({error:'User not found.'});
  result=await admin.auth.admin.updateUserById(id,body.action==='role'?{app_metadata:{...current.data.user.app_metadata,role:body.role}}:{ban_duration:body.suspended?'876000h':'none'});
 }else if(body.action==='support_reply'){
  const conversation=await admin.from('support_conversations').select('user_id').eq('id',id).single();
  if(conversation.error)return res.status(404).json({error:'Conversation not found.'});
  result=await admin.from('support_messages').insert({user_id:conversation.data.user_id,conversation_id:id,sender_role:'support',message:body.message}).select('id').single();
 }else{
  const settings={support_status:['support_conversations',{status:body.status}],market:['markets',{is_active:body.enabled}],provider:['payment_providers',{enabled:body.enabled}],withdrawal:['withdrawals',{status:body.status}]}[body.action];
  let query=admin.from(settings[0]).update(settings[1]).eq('id',id);
  if(body.action==='withdrawal')query=query.in('status',['requested','review']);
  result=await query.select('id').single();
 }
 const logged=await admin.from('audit_logs').update({action:'admin.'+body.action+(result.error?'.failed':'.completed')}).eq('id',audit.data.id);
 if(result.error)return res.status(409).json({error:'Change failed. The record may have changed or be unavailable.'});
 res.json({ok:true,warning:logged.error?'Change saved; audit completion could not be recorded.':null});
});
adminRoutes.get('/overview',async (_req,res)=>{
 const counts=await Promise.all(Object.keys(resources).map(async name=>{
  try {
   const {count,error}=await admin.from(name).select('id',{count:'exact',head:true});
   return {name,count:error?null:count,available:!error};
  } catch {return {name,count:null,available:false};}
 }));
 res.set('Cache-Control','no-store').json({counts,checked_at:new Date().toISOString()});
});
adminRoutes.get('/:resource',async(req,res)=>{
 const name=req.params.resource;
 if(!Object.hasOwn(resources,name))return res.status(404).json({error:'Unknown monitoring resource.'});
 const page=Number(req.query.page??1);
 if(!Number.isSafeInteger(page)||page<1||page>100000)return res.status(400).json({error:'Invalid page.'});
 const {data,count,error}=await admin.from(name).select(resources[name],{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*25,page*25-1);
 if(error)return res.status(503).json({error:'This monitoring resource is unavailable. Check database setup.'});
 res.set('Cache-Control','no-store').json({rows:data,total:count,page,page_size:25});
});
