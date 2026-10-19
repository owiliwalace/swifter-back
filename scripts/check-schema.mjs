import {admin} from '../config/database.js';
for(const [table,columns]of [['profiles','id,full_name,balance,currency,wallet_kes,payment_reference'],['site_files','id'],['notifications','id'],['support_messages','id'],['currencies','code']]){
 const {error}=await admin.from(table).select(columns).limit(0);
 console.log(table,error?{code:error.code,message:error.message}:'ready');
}