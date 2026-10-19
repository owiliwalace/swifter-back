import {admin} from '../config/database.js';
import {withdrawalSchema,referralSettingsSchema,influencerSchema,reviewSchema,uuidSchema,reconciliationSchema} from '../validators/finance.js';
function parse(schema,value,res){const result=schema.safeParse(value);if(!result.success){res.status(400).json({error:'Check the supplied details.'});return null;}return result.data;}
async function rpc(res,name,args){
 const {data,error}=await admin.rpc(name,args);
 if(error){const expected=['Legacy deposits require reconciliation before withdrawal','Insufficient available balance','Below withdrawal minimum','Request key reused with different details','Cannot cancel withdrawal','Invalid withdrawal transition','Withdrawal has no reserved funds'];return res.status(error.code==='P0001'?409:503).json({error:expected.includes(error.message)?error.message:'Unable to save this financial action. Check the record and database setup before retrying.'});}
 res.json({ok:true,id:data});
}
export async function requestWithdrawal(req,res){
 const body=parse(withdrawalSchema,req.body,res);if(!body)return;
 return rpc(res,'request_withdrawal',{p_user:req.user.id,p_amount:body.amount,p_phone:body.phone,p_source:body.source,p_key:body.request_key});
}
export async function getWithdrawals(req,res){
 const page=Number(req.query.page??1);if(!Number.isSafeInteger(page)||page<1||page>100000)return res.status(400).json({error:'Invalid page.'});
 const [history,settings]=await Promise.all([
  admin.from('withdrawals').select('id,amount,currency,source,status,destination,provider_reference,review_note,created_at',{count:'exact'}).eq('user_id',req.user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*25,page*25-1),
  admin.from('referral_settings').select('min_withdrawal').eq('id',true).single()
 ]);
 if(history.error||settings.error)return res.status(503).json({error:'Withdrawal service is unavailable. Check Firebase connectivity.'});
 res.json({rows:history.data,total:history.count,page,min_withdrawal:settings.data.min_withdrawal,payout_mode:'manual_review'});
}
export async function cancelWithdrawal(req,res){
 if(!parse(uuidSchema,req.params.id,res))return;
 return rpc(res,'review_withdrawal',{p_actor:req.user.id,p_id:req.params.id,p_status:'cancelled'});
}
export async function getReferrals(req,res){
 const page=Number(req.query.page??1);if(!Number.isSafeInteger(page)||page<1||page>100000)return res.status(400).json({error:'Invalid page.'});
 const [partner,settings,referrals,commissions,pending]=await Promise.all([
  admin.from('influencers').select('id,code,enabled,rate,available_kes,earned_kes').eq('id',req.user.id).maybeSingle(),
  admin.from('referral_settings').select('enabled,rate,first_deposit_only,min_withdrawal').eq('id',true).single(),
  admin.from('referrals').select('id',{count:'exact',head:true}).eq('user_id',req.user.id),
  admin.from('referral_commissions').select('id,deposit_amount,rate,amount,currency,created_at',{count:'exact'}).eq('user_id',req.user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*25,page*25-1),
  admin.rpc('pending_commission_withdrawals',{p_user:req.user.id})
 ]);
 if([partner,settings,referrals,commissions,pending].some(item=>item.error))return res.status(503).json({error:'Referral service is unavailable. Check Firebase connectivity.'});
 res.json({influencer:partner.data,settings:settings.data,referred_count:referrals.count,commissions:commissions.data,total:commissions.count,page,pending_kes:pending.data});
}
export async function getFinanceSettings(_req,res){
 const {data,error}=await admin.from('referral_settings').select('*').eq('id',true).single();
 if(error)return res.status(503).json({error:'Check Firebase connectivity to configure commissions.'});
 res.json({settings:data});
}
export async function setFinanceSettings(req,res){
 const body=parse(referralSettingsSchema,req.body,res);if(!body)return;
 return rpc(res,'configure_referrals',{p_actor:req.user.id,p_settings:body});
}
export async function setInfluencer(req,res){
 const body=parse(influencerSchema,req.body,res);if(!body)return;
 return rpc(res,'configure_influencer',{p_actor:req.user.id,p_user:body.user_id,p_code:body.code,p_enabled:body.enabled,p_rate:body.rate});
}
export async function reviewWithdrawal(req,res){
 if(!parse(uuidSchema,req.params.id,res))return;
 const body=parse(reviewSchema,req.body,res);if(!body)return;
 return rpc(res,'review_withdrawal',{p_actor:req.user.id,p_id:req.params.id,p_status:body.status,p_receipt:body.receipt||null,p_note:body.note||null});
}
export async function reconcileDeposit(req,res){
 if(!parse(uuidSchema,req.params.id,res))return;
 const body=parse(reconciliationSchema,req.body,res);if(!body)return;
 return rpc(res,'reconcile_deposit',{p_actor:req.user.id,p_id:req.params.id,p_user:body.user_id,p_receipt:body.receipt,p_note:body.note});
}
