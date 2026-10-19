import test from 'node:test';
import assert from 'node:assert/strict';
import {requireAdmin} from '../middlewares/admin.js';
import {adminActionSchema,adminCreateUserSchema,adminProfileSchema,catalogSchema} from '../validators/admin.js';
test('admin access requires server-managed app metadata',()=>{
 for(const user of [undefined,{}, {user_metadata:{role:'admin'}},{app_metadata:{role:'user'}}]){
  let status,next=false;
  requireAdmin({user},{status(code){status=code;return this;},json(){}},()=>{next=true;});
  assert.equal(status,403);assert.equal(next,false);
 }
 let allowed=false;requireAdmin({user:{app_metadata:{role:'admin'}}},{},()=>{allowed=true;});assert.equal(allowed,true);
});
test('admin CRUD cannot inject privileged account fields or financial balances',()=>{
 const user={email:'test@example.com',full_name:'Test User',password:'long-password'};
 assert.equal(adminCreateUserSchema.safeParse(user).success,true);
 for(const extra of [{role:'admin'},{email_confirm:true},{wallet_kes:999},{app_metadata:{role:'admin'}}])assert.equal(adminCreateUserSchema.safeParse({...user,...extra}).success,false);
 assert.equal(adminProfileSchema.safeParse({full_name:'Updated',wallet_kes:1000}).success,false);
 assert.equal(catalogSchema.safeParse({id:'market',name:'Market',provider_symbol:'1HZ10V',is_active:false}).success,true);
 assert.equal(catalogSchema.safeParse({id:'../users',name:'Market',provider_symbol:null,is_active:true}).success,false);
});
test('admin actions reject arbitrary balances, completion and role injection',()=>{
 for(const body of [{action:'role',role:'owner'},{action:'withdrawal',status:'completed'},{action:'provider',enabled:true,balance:100},{action:'suspend',suspended:'false'},{action:'support_reply',message:' '}])assert.equal(adminActionSchema.safeParse(body).success,false);
 assert.equal(adminActionSchema.safeParse({action:'role',role:'admin'}).success,true);
});
