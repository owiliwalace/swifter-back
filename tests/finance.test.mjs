import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';


import {withdrawalSchema,influencerSchema,referralSettingsSchema,reviewSchema} from '../validators/finance.js';

test('financial inputs reject ownership injection, invalid rates and unverified completion',()=>{
 const valid={amount:100,phone:'254712345678',source:'wallet',request_key:randomUUID()};
 assert.equal(withdrawalSchema.safeParse(valid).success,true);
 for(const change of [{amount:-1},{amount:1.001},{amount:'100'},{user_id:randomUUID()},{source:'demo'},{phone:'123'},{request_key:'x'}])assert.equal(withdrawalSchema.safeParse({...valid,...change}).success,false);
 assert.equal(influencerSchema.safeParse({user_id:randomUUID(),code:'good',enabled:true,rate:101}).success,false);
 assert.equal(referralSettingsSchema.safeParse({enabled:true,rate:5,first_deposit_only:false,min_withdrawal:100}).success,true);
 assert.equal(reviewSchema.safeParse({status:'completed'}).success,false);
});

