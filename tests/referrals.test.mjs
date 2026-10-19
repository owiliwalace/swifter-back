import test from 'node:test';
import assert from 'node:assert/strict';
import {signup} from '../controllers/authController.js';
import {getReferrals} from '../controllers/financeController.js';
import {admin} from '../config/database.js';
const response=()=>({code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('public signup requires a referral before creating accounts or sending mail',async()=>{
 const details={email:'test@example.com',password:'long-password',full_name:'Test',agreed:true};
 for(const referral of [undefined,'','   ','bad code','a']){const res=response();await signup({body:{...details,...(referral===undefined?{}:{referral_code:referral})}},res);assert.equal(res.code,400);assert.match(res.body.error,/referral code/);}
 const original=admin.from;let lookups=[];
 try{admin.from=table=>({select(){return this;},eq(key,value){lookups.push([table,key,value]);return this;},async maybeSingle(){return {data:null,error:null};}});
 const res=response();await signup({body:{...details,referral_code:' partner_1 '}},res);assert.equal(res.code,400);assert.match(res.body.error,/not active/);assert.ok(lookups.some(([,key,value])=>key==='code'&&value==='PARTNER_1'));assert.ok(lookups.some(([,key,value])=>key==='enabled'&&value===true));
 }finally{admin.from=original;}
});
test('influencers can only retrieve signups and earnings attributed to their own ID',async()=>{
 const from=admin.from,rpc=admin.rpc,filters=[];
 try{admin.from=table=>({select(){return this;},eq(key,value){filters.push([table,key,value]);return this;},order(){return this;},range(){return this;},single(){return this;},maybeSingle(){return this;},then(resolve){return Promise.resolve({data:table==='referrals'?[{id:'signup',referred_user_id:'member',code:'PARTNER',created_at:'2026-10-19'}]:{},count:1,error:null}).then(resolve);}});admin.rpc=async()=>({data:0,error:null});
 const res=response();await getReferrals({user:{id:'owner'},query:{referral_page:'1'}},res);assert.equal(res.code,200);assert.equal(res.body.referrals[0].code,'PARTNER');assert.ok(filters.some(([table,key,value])=>table==='referrals'&&key==='user_id'&&value==='owner'));
 const invalid=response();await getReferrals({user:{id:'owner'},query:{referral_page:'0'}},invalid);assert.equal(invalid.code,400);
 }finally{admin.from=from;admin.rpc=rpc;}
});
