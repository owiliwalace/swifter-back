import test from 'node:test';
import assert from 'node:assert/strict';
import {authEmail,smtpConfig} from '../services/authMail.js';
test('direct emails link only to the live frontend and use a fragment for the token',()=>{
 for(const type of ['signup','recovery','magiclink']){
  const mail=authEmail({type,token:'a'.repeat(64),email:'test@example.com'},{NODE_ENV:'production',SMTP_USER:'noreply@example.com'});
  assert.equal(mail.from.address,'noreply@example.com');
  assert.match(mail.text,/https:\/\/www.swifttrade.co.ke\/verify-email#type=/);
  assert.doesNotMatch(mail.text,/localhost|identitytoolkit\.googleapis\.com/);
  assert.match(mail.html,/token_hash=/);
 }
});
test('SMTP rejects incomplete settings and requires encrypted transport',()=>{
 const env={SMTP_HOST:'smtp.example.com',SMTP_PORT:'465',SMTP_USER:'noreply@example.com',SMTP_PASS:'test-password'};
 assert.equal(smtpConfig(env).secure,true);
 assert.equal(smtpConfig({...env,SMTP_PORT:'587'}).requireTLS,true);
 for(const overrides of [{SMTP_HOST:''},{SMTP_PORT:'25'},{SMTP_PASS:''},{SMTP_USER:''}])assert.throws(()=>smtpConfig({...env,...overrides}));
 assert.throws(()=>authEmail({type:'unsupported',token:'x',email:'test@example.com'}));
});
