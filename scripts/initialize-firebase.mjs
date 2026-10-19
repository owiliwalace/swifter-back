import {firebaseServices} from '../config/firebase.js';
import {currencies,paymentMethods} from '../config/paymentMethods.js';
export async function initializeDatabase(){
 const {db}=firebaseServices();
 const seeds=[['referral_settings','true',{id:true,enabled:false,rate:0,first_deposit_only:false,min_withdrawal:100}],
 ...currencies.map(item=>['currencies',item.code,{id:item.code,...item,decimals:{BTC:8,ETH:18,USDT:6,UGX:0}[item.code]??2,kind:['BTC','ETH','USDT'].includes(item.code)?'crypto':'fiat'}]),
 ...paymentMethods().map(item=>['payment_providers',item.id,{id:item.id,name:item.name,enabled:false,supported_currencies:item.currencies,created_at:new Date().toISOString()}])];
 for(const [collection,id,data]of seeds)await db.runTransaction(async tx=>{const ref=db.collection(collection).doc(id);const existing=await tx.get(ref);if(!existing.exists)tx.create(ref,data);});
}
if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\','/'))){
 try{await initializeDatabase();console.log('Firebase catalog and default referral settings initialized; existing documents preserved.');}
 catch(error){console.error('Firebase initialization failed:',error.code||'unavailable');process.exitCode=1;}
 finally{await firebaseServices().db.terminate();}
}
