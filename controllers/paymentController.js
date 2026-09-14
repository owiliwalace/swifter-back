import {paymentMethods,currencies} from '../config/paymentMethods.js';
export function getMethods(_req,res){res.json({methods:paymentMethods(),currencies});}
export async function createDeposit(req,res){
 const url=process.env.MPESA_STK_SERVICE_URL,token=process.env.PAYMENTS_SERVICE_TOKEN;
 if(!url||!token||token.length<32)return res.status(503).json({error:'Payment service is not configured.'});
 try{
 const response=await fetch(url.replace(/\/$/,'')+'/api/payments/mpesa/stk',{method:'POST',headers:{'Content-Type':'application/json','X-Service-Token':token},body:JSON.stringify({phone:req.body.phone,amount:req.body.amount,userId:req.user.id}),signal:AbortSignal.timeout(45000)});
 const body=await response.json();res.status(response.status).json(body);
 }catch{res.status(502).json({error:'Payment service unavailable. Check deposit history before retrying.'});}
}