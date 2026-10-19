import '../config/env.js';
import nodemailer from 'nodemailer';
import {smtpConfig} from '../services/authMail.js';
const recipient=process.argv[2];
if(!recipient||!/^\S+@\S+\.\S+$/.test(recipient))throw new Error('Usage: node scripts/test-smtp.mjs recipient@example.com');
let transport;
try{
 const config=smtpConfig();
 console.log('Connecting to '+config.host+':'+config.port+' using '+(config.secure?'SSL/TLS':'STARTTLS')+'...');
 transport=nodemailer.createTransport(config);
 const result=await transport.sendMail({from:{name:'SwiftTrade',address:config.auth.user},to:recipient,subject:'SwiftTrade SMTP delivery test',text:'This is the SwiftTrade email delivery test you requested. No account action is needed.'});
 if(!result.accepted?.length||result.rejected?.length)throw new Error('SMTP rejected the test recipient.');
 console.log('Mail server accepted the test email. Check the recipient inbox and spam folder.');
}catch(error){
 if(error.code==='ETIMEDOUT')console.error('Connection timed out. The mail server did not respond. Check SMTP_HOST, network access and the mail server firewall.');
 else if(error.code==='EAUTH')console.error('Mailbox login failed. Check SMTP_USER and SMTP_PASS.');
 else if(['ENOTFOUND','EAI_AGAIN'].includes(error.code))console.error('Mail server hostname could not be resolved. Check SMTP_HOST and DNS.');
 else console.error('SMTP test failed:',error.code||(/^(Missing email settings:|SMTP_PORT must be|SMTP rejected)/.test(error.message)?error.message:'delivery error'));
 process.exitCode=1;
}finally{transport?.close();}
