import {setTimeout as delay} from 'node:timers/promises';
import {frontendOrigin} from '../config/frontend.js';

export function emailConfig(env=process.env){
 const fields=['EMAILJS_SERVICE_ID','EMAILJS_TEMPLATE_ID','EMAILJS_PUBLIC_KEY','EMAILJS_PRIVATE_KEY'];
 const missing=fields.filter(key=>!env[key]?.trim());
 if(missing.length)throw Object.assign(new Error('Missing EmailJS settings: '+missing.join(', ')+'.'),{code:'EMAILJS_NOT_CONFIGURED'});
 return {service_id:env.EMAILJS_SERVICE_ID.trim(),template_id:env.EMAILJS_TEMPLATE_ID.trim(),user_id:env.EMAILJS_PUBLIC_KEY.trim(),accessToken:env.EMAILJS_PRIVATE_KEY.trim()};
}
export function authEmail({type,token,email},env=process.env){
 if(!['signup','recovery','magiclink'].includes(type)||typeof token!=='string'||!token)throw new Error('Invalid email verification data.');
 const params=new URLSearchParams({type,token_hash:token});
 const link=frontendOrigin(env)+'/verify-email#'+params.toString();
 const title=type==='recovery'?'Reset your SwiftTrade password':'Confirm your SwiftTrade account';
 const action=type==='recovery'?'Reset password':'Confirm email address';
 return {to:email,subject:title,action_url:link,action_text:action,email_type:type,
 text:`${title}\n\n${action}: ${link}\n\nThis is a single-use link. If it has expired, request a new one. If you did not request this email, you can ignore it.`};
}
export function emailjsPayload(mail,env=process.env){
 if(typeof mail.to!=='string'||!/^\S+@\S+\.\S+$/.test(mail.to)||typeof mail.subject!=='string'||typeof mail.text!=='string')throw new Error('Invalid email message.');
 return {...emailConfig(env),template_params:{to_email:mail.to,subject:mail.subject,message:mail.text,action_url:mail.action_url||frontendOrigin(env)+'/login',action_text:mail.action_text||'Open SwiftTrade',app_name:'SwiftTrade',email_type:mail.email_type||'test'}};
}
let deliveryQueue=Promise.resolve(),lastStarted=0;
function scheduleDelivery(fn){
 const task=deliveryQueue.then(async()=>{await delay(Math.max(0,1000-(Date.now()-lastStarted)));lastStarted=Date.now();return fn();});
 deliveryQueue=task.catch(()=>{});return task;
}
export async function sendEmail(mail,{env=process.env,fetchImpl=globalThis.fetch}={}){
 const payload=emailjsPayload(mail,env);
 return scheduleDelivery(async()=>{
  let response;
  try{response=await fetchImpl('https://api.emailjs.com/api/v1.0/email/send',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000),redirect:'error',
  });}catch(error){throw Object.assign(new Error('EmailJS could not be reached. Check HTTPS access and try again.'),{code:error.name==='TimeoutError'?'EMAILJS_TIMEOUT':'EMAILJS_CONNECTION_FAILED'});}
  // Do not log provider response bodies: they can contain addresses or submitted values.
  if(response.status!==200){
   const message=response.status===429?'EmailJS rate limit reached. Try again shortly.':'EmailJS rejected the request. Check the service, template, keys and non-browser API access in the EmailJS dashboard.';
   await response.body?.cancel();
   throw Object.assign(new Error(message),{code:'EMAILJS_HTTP_'+response.status});
  }
  await response.body?.cancel();
  return {accepted:true,provider:'emailjs'};
 });
}
export async function sendAuthEmail(details){return sendEmail(authEmail(details));}
