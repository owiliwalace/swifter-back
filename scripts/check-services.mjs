import {admin} from '../config/database.js';
import nodemailer from 'nodemailer';
import {smtpConfig} from '../services/authMail.js';
for(const table of ['profiles','deposits','influencers','referrals','referral_settings','referral_commissions','withdrawals','audit_logs']){
 const {error}=await admin.from(table).select('*').limit(0);
 console.log(table,error?'UNAVAILABLE ('+error.code+')':'ready');
 if(error)process.exitCode=1;
}
const settings=await admin.from('referral_settings').select('enabled,rate,first_deposit_only,min_withdrawal').eq('id',true).single();
if(!settings.error)console.log('Referral settings:',JSON.stringify(settings.data));
let transport;
try{transport=nodemailer.createTransport(smtpConfig());await transport.verify();console.log('SMTP connection and authentication verified; no email sent.');}
catch(error){console.log('SMTP verification failed:',error.code||'configuration error');process.exitCode=1;}
finally{transport?.close();}
