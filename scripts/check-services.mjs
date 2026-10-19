import {admin} from '../config/database.js';
import {emailConfig} from '../services/authMail.js';
for(const table of ['profiles','deposits','influencers','referrals','referral_settings','referral_commissions','withdrawals','audit_logs']){
 const {error}=await admin.from(table).select('*').limit(0);
 console.log(table,error?'UNAVAILABLE ('+error.code+')':'ready');
 if(error)process.exitCode=1;
}
const settings=await admin.from('referral_settings').select('enabled,rate,first_deposit_only,min_withdrawal').eq('id',true).single();
if(!settings.error)console.log('Referral settings:',JSON.stringify(settings.data));
try{emailConfig();console.log('EmailJS configuration present; use npm run email:test -- recipient@example.com to verify delivery.');}
catch(error){console.log('EmailJS configuration incomplete:',error.message);process.exitCode=1;}
