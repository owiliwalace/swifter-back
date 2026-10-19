import { admin } from '../config/database.js';
export async function getAccount(req, res) {
  const { data, error } = await admin.from('profiles').select('id,full_name,balance,currency,wallet_kes,payment_reference').eq('id', req.user.id).single();
  if (error) return res.status(503).json({ error: 'Profile is unavailable. Check the database setup.' });
  res.json({ profile: {...data, is_admin: req.user.app_metadata?.role === 'admin'} });
}
export async function getDeposits(req, res) {
  let { data, error } = await admin.from('deposits').select('id,amount,currency,channel,status,environment,receipt,created_at').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50);
  // Older installations can display history without treating unknown funds as production.
  if(error?.code==='42703'){
    const legacy=await admin.from('deposits').select('id,amount,currency,channel,status,receipt,created_at').eq('user_id',req.user.id).order('created_at',{ascending:false}).limit(50);
    error=legacy.error;data=legacy.data?.map(row=>({...row,environment:'unknown'}));
  }
  if (error) return res.status(503).json({error:'Deposit history is temporarily unavailable. Your login is still valid.',code:'DEPOSIT_HISTORY_UNAVAILABLE'});
  res.json({ deposits: data });
}
export async function getPaymentInstructions(_req, res) {
  let environment=null;
  try{
    if(process.env.MPESA_STK_SERVICE_URL){
      const response=await fetch(process.env.MPESA_STK_SERVICE_URL.replace(/\/$/,'')+'/api/health',{signal:AbortSignal.timeout(5000)});
      const data=await response.json();
      if(response.ok&&['production','sandbox'].includes(data.environment))environment=data.environment;
    }
  }catch{/* Never guess the live service's payment environment. */}
  res.json({ shortcode: process.env.MPESA_SHORTCODE || null, environment });
}
