import '../config/env.js';
import {emailConfig,sendEmail} from '../services/authMail.js';
import {frontendOrigin} from '../config/frontend.js';
const recipient=process.argv[2];
if(!recipient||!/^\S+@\S+\.\S+$/.test(recipient))throw new Error('Usage: node scripts/test-email.mjs recipient@example.com');
try{
 emailConfig();
 console.log('Sending test email through EmailJS over HTTPS...');
 await sendEmail({to:recipient,subject:'SwiftTrade EmailJS delivery test',text:'This is the SwiftTrade email delivery test you requested. No account action is needed.',action_url:frontendOrigin()+'/login',action_text:'Open SwiftTrade',email_type:'test'});
 console.log('EmailJS accepted the test email. Check the recipient inbox and spam folder.');
}catch(error){console.error('Email test failed:',error.code||'configuration error',error.message);process.exitCode=1;}
