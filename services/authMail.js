import nodemailer from 'nodemailer';
import {frontendOrigin} from '../config/frontend.js';
export function smtpConfig(env=process.env){
 const port=Number(env.SMTP_PORT),secure=port===465;
 const missing=['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS'].filter(key=>!env[key]?.trim());
 if(missing.length)throw new Error('Missing email settings: '+missing.join(', ')+'.');
 if(![465,587].includes(port))throw new Error('SMTP_PORT must be 465 (SSL/TLS) or 587 (STARTTLS).');
 return {host:env.SMTP_HOST,port,secure,requireTLS:!secure,auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,logger:false,debug:false};
}
export function authEmail({type,token,email},env=process.env){
 if(!['signup','recovery','magiclink'].includes(type)||typeof token!=='string'||!token)throw new Error('Invalid email verification data.');
 const params=new URLSearchParams({type,token_hash:token});
 const link=frontendOrigin(env)+'/verify-email#'+params.toString();
 const title=type==='recovery'?'Reset your SwiftTrade password':'Confirm your SwiftTrade account';
 const action=type==='recovery'?'Reset password':'Confirm email address';
 const safeLink=link.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 return {from:{name:'SwiftTrade',address:env.SMTP_USER},to:email,subject:title,
 text:`${title}\n\n${action}: ${link}\n\nThis is a single-use link. If it has expired, request a new one. If you did not request this email, you can ignore it.`,
 html:`<div style="background:#f2f5fb;padding:32px;font-family:Arial,sans-serif;color:#10213d"><div style="max-width:540px;margin:auto;background:#fff;padding:32px;border-radius:12px"><p style="color:#214d94;font-weight:bold">SwiftTrade</p><h1 style="font-size:25px">${title}</h1><p>Continue securely using the button below.</p><p style="margin:30px 0"><a href="${safeLink}" style="background:#163f88;color:white;padding:14px 20px;text-decoration:none;border-radius:6px">${action}</a></p><p style="font-size:13px;color:#5e6e85">This is a single-use link. If it has expired, request a new one. If you did not request this email, you can ignore it.</p></div></div>`};
}
export async function sendAuthEmail(details){
 const transport=nodemailer.createTransport(smtpConfig());
 try{const result=await transport.sendMail(authEmail(details));if(!result.accepted?.length||result.rejected?.length)throw new Error('SMTP delivery rejected.');}
 finally{transport.close();}
}
