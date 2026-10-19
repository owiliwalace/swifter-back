import test from 'node:test';
import assert from 'node:assert/strict';
import {authEmail,emailConfig,emailjsPayload,sendEmail} from '../services/authMail.js';
const env={NODE_ENV:'production',EMAILJS_SERVICE_ID:'service_test',EMAILJS_TEMPLATE_ID:'template_test',EMAILJS_PUBLIC_KEY:'public-test',EMAILJS_PRIVATE_KEY:'private-test'};
const mail=()=>authEmail({type:'signup',token:'a'.repeat(64),email:'test@example.com'},env);
test('verification and recovery links use the website and keep tokens in the fragment',()=>{
 for(const type of ['signup','recovery','magiclink']){
  const message=authEmail({type,token:'a'.repeat(64),email:'test@example.com'},env);
  assert.match(message.action_url,/^https:\/\/www.swifttrade.co.ke\/verify-email#type=/);
  const link=new URL(message.action_url);assert.equal(link.search,'');assert.equal(new URLSearchParams(link.hash.slice(1)).get('type'),type);
  assert.match(message.text,/token_hash=/);assert.equal(message.to,'test@example.com');
 }
 assert.match(authEmail({type:'recovery',token:'x',email:'test@example.com'},env).subject,/Reset/);
 assert.throws(()=>authEmail({type:'unsupported',token:'x',email:'test@example.com'},env));
});
test('EmailJS requires complete backend configuration and maps template variables',()=>{
 for(const name of ['EMAILJS_SERVICE_ID','EMAILJS_TEMPLATE_ID','EMAILJS_PUBLIC_KEY','EMAILJS_PRIVATE_KEY'])assert.throws(()=>emailConfig({...env,[name]:''}),new RegExp(name));
 const payload=emailjsPayload(mail(),env);
 assert.equal(payload.service_id,'service_test');assert.equal(payload.template_id,'template_test');assert.equal(payload.user_id,'public-test');assert.equal(payload.accessToken,'private-test');
 assert.equal(payload.template_params.to_email,'test@example.com');assert.equal(payload.template_params.action_url,mail().action_url);
 assert.equal(JSON.stringify(payload.template_params).includes('private-test'),false);
 assert.throws(()=>emailjsPayload({...mail(),to:'not-an-email'},env));
});
test('EmailJS sends through HTTPS with authentication and accepts only successful responses',async()=>{
 let called=0;
 const response=await sendEmail(mail(),{env,fetchImpl:async(url,options)=>{
  called++;assert.equal(url,'https://api.emailjs.com/api/v1.0/email/send');assert.equal(options.method,'POST');assert.equal(options.redirect,'error');
  const payload=JSON.parse(options.body);assert.equal(payload.accessToken,'private-test');assert.equal(payload.template_params.to_email,'test@example.com');return {status:200};
 }});
 assert.equal(called,1);assert.deepEqual(response,{accepted:true,provider:'emailjs'});
 await assert.rejects(sendEmail(mail(),{env,fetchImpl:async()=>({status:403})}),error=>error.code==='EMAILJS_HTTP_403'&&!error.message.includes('private-test'));
 // A failed request must not prevent subsequent deliveries from running.
 const next=await sendEmail(mail(),{env,fetchImpl:async()=>({status:200})});assert.equal(next.accepted,true);
});
test('missing configuration makes no external request; network errors reveal no secrets',async()=>{
 let calls=0;await assert.rejects(sendEmail(mail(),{env:{},fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);
 await assert.rejects(sendEmail(mail(),{env,fetchImpl:async()=>{throw new Error('private-test');}}),error=>error.code==='EMAILJS_CONNECTION_FAILED'&&!error.message.includes('private-test'));
});
