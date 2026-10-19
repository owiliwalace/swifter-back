import test from 'node:test';
import assert from 'node:assert/strict';
import {financialAction} from '../services/firebaseFinance.js';
import {MemoryFirestore} from './memory-firestore.mjs';
function fixture(){
 const db=new MemoryFirestore();
 db.put('profiles','customer',{id:'customer',wallet_kes:0});db.put('profiles','partner',{id:'partner',wallet_kes:0});
 db.put('influencers','partner',{id:'partner',code:'PARTNER',enabled:true,rate:null,available_kes:0,earned_kes:0});
 db.put('referrals','customer',{user_id:'partner',referred_user_id:'customer'});
 db.put('referral_settings','true',{enabled:true,rate:10,first_deposit_only:false,min_withdrawal:100});
 const services={db,auth:{getUser:async id=>({uid:id,disabled:false,customClaims:{role:id==='operator'?'admin':'user'}})}};
 return {db,call:(name,args)=>financialAction(name,args,services)};
}
test('Firestore deposit retries and shared receipts credit once and earn one commission',async()=>{
 const {db,call}=fixture();db.put('deposits','d1',{id:'d1',user_id:'customer',amount:1000,status:'pending',environment:'production'});
 await Promise.all(Array.from({length:5},()=>call('credit_mpesa_deposit',{p_id:'d1',p_receipt:'RECEIPT0001'})));
 assert.equal(db.value('profiles','customer').wallet_kes,1000);assert.equal(db.value('influencers','partner').available_kes,100);
 db.put('deposits','d2',{id:'d2',user_id:'customer',amount:1000,status:'pending',environment:'production'});
 await assert.rejects(call('credit_mpesa_deposit',{p_id:'d2',p_receipt:'RECEIPT0001'}));assert.equal(db.value('profiles','customer').wallet_kes,1000);
});
test('Firestore sandbox never credits cash; first deposit rules and disabled partners apply',async()=>{
 const {db,call}=fixture();db.value('referral_settings','true').first_deposit_only=true;
 for(const [id,environment]of [['sandbox','sandbox'],['first','production'],['second','production']]){
  db.put('deposits',id,{id,user_id:'customer',amount:1000,status:'pending',environment});await call('credit_mpesa_deposit',{p_id:id,p_receipt:'RECEIPT'+id.toUpperCase()});
 }
 assert.equal(db.value('profiles','customer').wallet_kes,2000);assert.equal(db.value('influencers','partner').earned_kes,100);
 db.value('referral_settings','true').first_deposit_only=false;db.value('influencers','partner').enabled=false;
 db.put('deposits','third',{id:'third',user_id:'customer',amount:1000,status:'pending',environment:'production'});await call('credit_mpesa_deposit',{p_id:'third',p_receipt:'RECEIPTTHIRD'});
 assert.equal(db.value('influencers','partner').earned_kes,100);
});
test('Firestore withdrawal concurrency prevents overspending and duplicate key reuse',async()=>{
 const {db,call}=fixture();db.value('profiles','customer').wallet_kes=1000;
 const request={p_user:'customer',p_amount:700,p_source:'wallet',p_phone:'254712345678',p_key:'same-key'};
 const ids=await Promise.all([call('request_withdrawal',request),call('request_withdrawal',request)]);
 assert.equal(ids[0],ids[1]);assert.equal(db.value('profiles','customer').wallet_kes,300);
 await assert.rejects(call('request_withdrawal',{...request,p_amount:600}),/Request key reused/);
 await assert.rejects(call('request_withdrawal',{...request,p_key:'other-key'}),/Insufficient/);
 await assert.rejects(call('review_withdrawal',{p_actor:'stranger',p_id:ids[0],p_status:'cancelled'}));
 await call('review_withdrawal',{p_actor:'customer',p_id:ids[0],p_status:'cancelled'});
 assert.equal(db.value('profiles','customer').wallet_kes,1000);
 await assert.rejects(call('review_withdrawal',{p_actor:'customer',p_id:ids[0],p_status:'cancelled'}));
 assert.equal(db.value('profiles','customer').wallet_kes,1000);
});
test('Firestore admin review enforces permissions, lifecycle and unique payout receipts',async()=>{
 const {db,call}=fixture();db.value('influencers','partner').available_kes=1000;
 const request={p_user:'partner',p_amount:200,p_source:'commission',p_phone:'254712345678',p_key:'payout1'};
 const id=await call('request_withdrawal',request);
 await assert.rejects(call('review_withdrawal',{p_actor:'partner',p_id:id,p_status:'approved'}),/Administrator/);
 await assert.rejects(call('review_withdrawal',{p_actor:'operator',p_id:id,p_status:'completed',p_receipt:'PAYOUT00001'}));
 for(const status of ['approved','processing','completed'])await call('review_withdrawal',{p_actor:'operator',p_id:id,p_status:status,p_receipt:'PAYOUT00001'});
 assert.equal(db.value('influencers','partner').available_kes,800);
 const second=await call('request_withdrawal',{...request,p_key:'payout2'});
 for(const status of ['approved','processing'])await call('review_withdrawal',{p_actor:'operator',p_id:second,p_status:status});
 await assert.rejects(call('review_withdrawal',{p_actor:'operator',p_id:second,p_status:'completed',p_receipt:'PAYOUT00001'}),/already used/);
});
test('Firestore reconciliation validates operator, owner, environment and preserves full credit',async()=>{
 const {db,call}=fixture();db.put('deposits','ipn',{id:'ipn',user_id:null,amount:500,status:'review',environment:'production',receipt:'IPNRECEIPT1'});
 const args={p_actor:'operator',p_id:'ipn',p_user:'customer',p_receipt:'IPNRECEIPT1',p_note:'Independently checked merchant records'};
 await assert.rejects(call('reconcile_deposit',{...args,p_actor:'customer'}));
 await call('reconcile_deposit',args);assert.equal(db.value('profiles','customer').wallet_kes,500);
 await assert.rejects(call('reconcile_deposit',args));assert.equal(db.value('profiles','customer').wallet_kes,500);
});
