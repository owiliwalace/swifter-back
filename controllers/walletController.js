import {admin} from '../config/supabase.js';
export async function getWallets(req,res){
 const [catalog,profile,wallets]=await Promise.all([
  admin.from('currencies').select('code,name,decimals,kind').order('code'),
  admin.from('profiles').select('wallet_kes').eq('id',req.user.id).single(),
  admin.from('currency_wallets').select('currency,balance::text').eq('user_id',req.user.id)
 ]);
 if(catalog.error||profile.error||wallets.error)return res.status(503).json({error:'Currency balances are unavailable.'});
 res.json({currencies:catalog.data,wallets:[{currency:'KES',balance:String(profile.data.wallet_kes)},...wallets.data]});
}
export async function openWallet(req,res){
 if(!req.body||Object.keys(req.body).some(key=>key!=='currency')||typeof req.body.currency!=='string')return res.status(400).json({error:'Choose a supported currency.'});
 const currency=req.body.currency;
 const {data,error}=await admin.from('currencies').select('code').eq('code',currency).maybeSingle();
 if(error)return res.status(503).json({error:'Currency lookup is unavailable.'});
 if(!data)return res.status(400).json({error:'Choose a supported currency.'});
 if(currency!=='KES'){
  const result=await admin.from('currency_wallets').upsert({user_id:req.user.id,currency},{onConflict:'user_id,currency',ignoreDuplicates:true});
  if(result.error)return res.status(503).json({error:'Could not open this currency wallet.'});
 }
 res.json({ok:true,currency});
}
