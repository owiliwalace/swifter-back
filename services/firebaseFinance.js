import {randomUUID} from 'node:crypto';
import {firebaseServices} from '../config/firebase.js';
import {now,identifier,failure,defaults} from './firestoreRepository.js';
const cents=value=>{const number=Number(value);if(!Number.isFinite(number)||!Number.isSafeInteger(Math.round(number*100))||Math.abs(number*100-Math.round(number*100))>1e-6)throw failure('Invalid monetary amount');return Math.round(number*100);};
const ensure=(condition,message)=>{if(!condition)throw failure(message);};
async function adminActor(auth,id){const user=await auth.getUser(id);ensure(!user.disabled&&user.customClaims?.role==='admin','Administrator required');}
function audit(tx,db,actor,action,metadata){const id=randomUUID();tx.create(db.collection('audit_logs').doc(id),defaults('audit_logs',{id,user_id:actor,action,metadata}));}
function notify(tx,db,user,title,body){const id=randomUUID();tx.create(db.collection('notifications').doc(id),defaults('notifications',{id,user_id:user,title,body,read_at:null}));}
export async function financialAction(name,args,services=firebaseServices()){
 const {db,auth}=services;const ref=(table,id)=>db.collection(table).doc(String(id));
 if(['configure_referrals','configure_influencer','reconcile_deposit','admin_user_directory'].includes(name))await adminActor(auth,args.p_actor);
 if(name==='admin_user_directory'){
  let users=[],pageToken;
  do{const page=await auth.listUsers(1000,pageToken);users.push(...page.users);pageToken=page.pageToken;}while(pageToken);
  const profiles=await db.collection('profiles').get(),byId=new Map(profiles.docs.map(doc=>[doc.id,doc.data()]));
  const search=String(args.p_search||'').toLowerCase();
  const matches=users.map(user=>({id:user.uid,email:user.email,full_name:byId.get(user.uid)?.full_name||'',wallet_kes:byId.get(user.uid)?.wallet_kes||0,currency:byId.get(user.uid)?.currency||'USD',role:user.customClaims?.role||'user',suspended:user.disabled,email_confirmed:user.emailVerified,created_at:new Date(user.metadata.creationTime).toISOString(),last_sign_in_at:user.metadata.lastSignInTime||null})).filter(user=>(user.email+' '+user.full_name+' '+user.id).toLowerCase().includes(search)).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
  return {rows:matches.slice((args.p_page-1)*25,args.p_page*25),total:matches.length,page:args.p_page,page_size:25};
 }
 if(name==='pending_commission_withdrawals'){
  const docs=await db.collection('withdrawals').where('user_id','==',args.p_user).get();
  return docs.docs.reduce((sum,doc)=>{const item=doc.data();return sum+(item.source==='commission'&&['requested','review','approved','processing'].includes(item.status)?cents(item.amount):0);},0)/100;
 }
 if(name==='configure_referrals')return db.runTransaction(async tx=>{
  const s=args.p_settings;ensure(typeof s.enabled==='boolean'&&Number.isFinite(s.rate)&&s.rate>=0&&s.rate<=100&&typeof s.first_deposit_only==='boolean'&&cents(s.min_withdrawal)>0,'Invalid referral settings');
  tx.set(ref('referral_settings','true'),{id:true,...s});audit(tx,db,args.p_actor,'referrals.configured',s);return null;
 });
 if(name==='configure_influencer')return db.runTransaction(async tx=>{
  const [profile,existing,code]=await Promise.all([tx.get(ref('profiles',args.p_user)),tx.get(ref('influencers',args.p_user)),tx.get(ref('_referral_codes',args.p_code))]);
  ensure(profile.exists,'Account unavailable');ensure(!code.exists||code.data().user_id===args.p_user,'Referral code already assigned');
  ensure(!existing.exists||existing.data().code===args.p_code,'Referral codes cannot be changed');
  tx.set(ref('influencers',args.p_user),{...(existing.data()||defaults('influencers',{id:args.p_user})),code:args.p_code,enabled:args.p_enabled,rate:args.p_rate});
  tx.set(ref('_referral_codes',args.p_code),{user_id:args.p_user});audit(tx,db,args.p_actor,'influencer.configured',{user_id:args.p_user,enabled:args.p_enabled,rate:args.p_rate});return null;
 });
 if(name==='request_withdrawal')return db.runTransaction(async tx=>{
  const amount=cents(args.p_amount);ensure(amount>0&&amount<=15000000&&['wallet','commission'].includes(args.p_source)&&/^254[17]\d{8}$/.test(args.p_phone),'Invalid withdrawal');
  const id=identifier(args.p_user,args.p_key),requestRef=ref('_withdrawal_requests',id);
  const [profile,settings,request,partner,deposits]=await Promise.all([tx.get(ref('profiles',args.p_user)),tx.get(ref('referral_settings','true')),tx.get(requestRef),tx.get(ref('influencers',args.p_user)),tx.get(db.collection('deposits').where('user_id','==',args.p_user))]);
  ensure(profile.exists&&settings.exists,'Account unavailable');
  if(request.exists){const old=request.data();ensure(old.amount===args.p_amount&&old.phone===args.p_phone&&old.source===args.p_source,'Request key reused with different details');return old.withdrawal_id;}
  ensure(amount>=cents(settings.data().min_withdrawal),'Below withdrawal minimum');
  if(args.p_source==='wallet')ensure(!deposits.docs.some(doc=>doc.data().status==='completed'&&doc.data().environment==='unknown'),'Legacy deposits require reconciliation before withdrawal');
  const source=args.p_source==='wallet'?profile:partner,field=args.p_source==='wallet'?'wallet_kes':'available_kes';
  ensure(source.exists&&cents(source.data()[field])>=amount,'Insufficient available balance');
  const withdrawalId=randomUUID();
  tx.update(source.ref,{[field]:(cents(source.data()[field])-amount)/100});
  tx.create(ref('withdrawals',withdrawalId),defaults('withdrawals',{id:withdrawalId,user_id:args.p_user,amount:args.p_amount,source:args.p_source,reserved:true,request_key:args.p_key,provider_id:'mpesa',destination:{phone:args.p_phone}}));
  tx.create(requestRef,{amount:args.p_amount,source:args.p_source,phone:args.p_phone,withdrawal_id:withdrawalId});
  audit(tx,db,args.p_user,'withdrawal.requested',{withdrawal_id:withdrawalId,amount:args.p_amount,source:args.p_source});notify(tx,db,args.p_user,'Withdrawal requested','Your withdrawal is reserved for review.');return withdrawalId;
 });
 if(name==='review_withdrawal'){
  if(args.p_status!=='cancelled')await adminActor(auth,args.p_actor);
  return db.runTransaction(async tx=>{
   const withdrawal=await tx.get(ref('withdrawals',args.p_id)),item=withdrawal.data();
   ensure(item?.reserved,'Withdrawal has no reserved funds');
   const transitions={approved:['requested','review'],processing:['approved'],completed:['processing'],rejected:['requested','review','approved'],cancelled:['requested','review']};
   ensure(transitions[args.p_status]?.includes(item.status),'Invalid withdrawal transition');
   if(args.p_status==='cancelled')ensure(item.user_id===args.p_actor,'Cannot cancel withdrawal');
   const balanceRef=ref(item.source==='wallet'?'profiles':'influencers',item.user_id),balance=await tx.get(balanceRef);
   let receipt;
   if(args.p_status==='completed'){
    ensure(/^[A-Z0-9]{8,20}$/.test(args.p_receipt||''),'Verified payout receipt required');
    receipt=await tx.get(ref('_payout_receipts',args.p_receipt));ensure(!receipt.exists,'Payout receipt already used');
   }
   if(['rejected','cancelled'].includes(args.p_status)){
    ensure(balance.exists,'Account unavailable');const field=item.source==='wallet'?'wallet_kes':'available_kes';
    tx.update(balanceRef,{[field]:(cents(balance.data()[field])+cents(item.amount))/100});
   }
   if(receipt)tx.create(ref('_payout_receipts',args.p_receipt),{withdrawal_id:args.p_id});
   tx.update(withdrawal.ref,{status:args.p_status,review_note:args.p_note||null,provider_reference:args.p_status==='completed'?args.p_receipt:item.provider_reference||null});
   audit(tx,db,args.p_actor,'withdrawal.'+args.p_status,{withdrawal_id:args.p_id});notify(tx,db,item.user_id,'Withdrawal '+args.p_status,'Your withdrawal is '+args.p_status+'.');return null;
  });
 }
 if(['credit_mpesa_deposit','reconcile_deposit'].includes(name))return db.runTransaction(async tx=>{
  const deposit=await tx.get(ref('deposits',args.p_id));let d=deposit.data();ensure(d,'Unmatched deposit');
  ensure(/^[A-Z0-9]{8,20}$/.test(args.p_receipt||''),'Invalid receipt');ensure(!d.receipt||d.receipt===args.p_receipt,'Receipt mismatch');
  if(name==='reconcile_deposit'){
   ensure(d.environment!=='sandbox'&&d.status==='review'&&args.p_note?.trim().length>=10,'Deposit cannot be reconciled');
   ensure(!d.user_id||d.user_id===args.p_user,'Deposit owner mismatch');d={...d,user_id:args.p_user,environment:'production'};
  }else if(d.status==='completed')return null;
  ensure(d.user_id,'Unmatched deposit');ensure(['sandbox','production'].includes(d.environment),'Payment environment requires reconciliation');
  const [receipt,entry,profile,settings,attribution]=await Promise.all([tx.get(ref('_receipts',args.p_receipt)),tx.get(ref('wallet_entries',args.p_id)),tx.get(ref('profiles',d.user_id)),tx.get(ref('referral_settings','true')),tx.get(ref('referrals',d.user_id))]);
  ensure(!receipt.exists||receipt.data().deposit_id===args.p_id,'Receipt already used');ensure(profile.exists,'Account unavailable');
  const amount=cents(d.amount);ensure(amount>0&&amount<=15000000,'Invalid deposit amount');
  let partner,commission,earlier;
  if(d.environment==='production'&&!entry.exists&&settings.data()?.enabled&&attribution.exists){
   partner=await tx.get(ref('influencers',attribution.data().user_id));
   commission=await tx.get(ref('referral_commissions',args.p_id));
   earlier=await tx.get(db.collection('wallet_entries').where('user_id','==',d.user_id));
  }
  tx.set(ref('_receipts',args.p_receipt),{deposit_id:args.p_id});
  tx.update(deposit.ref,{user_id:d.user_id,environment:d.environment,receipt:args.p_receipt,status:'completed',completed_at:now()});
  if(d.environment==='production'&&!entry.exists){
   tx.create(ref('wallet_entries',args.p_id),defaults('wallet_entries',{id:args.p_id,deposit_id:args.p_id,user_id:d.user_id,amount:d.amount,currency:'KES'}));
   tx.update(profile.ref,{wallet_kes:(cents(profile.data().wallet_kes)+amount)/100});
   notify(tx,db,d.user_id,'Deposit confirmed','KES '+d.amount+' has been credited to your wallet.');
   if(partner?.exists&&partner.data().enabled&&!commission.exists&&(!settings.data().first_deposit_only||earlier.empty)){
    const rate=partner.data().rate??settings.data().rate;ensure(Number.isFinite(rate)&&rate>=0&&rate<=100,'Invalid commission rate');
    const earned=Math.round(amount*rate/100);
    if(earned>0){
     tx.create(ref('referral_commissions',args.p_id),defaults('referral_commissions',{id:args.p_id,deposit_id:args.p_id,user_id:partner.id,referred_user_id:d.user_id,deposit_amount:d.amount,rate,amount:earned/100,currency:'KES'}));
     tx.update(partner.ref,{available_kes:(cents(partner.data().available_kes)+earned)/100,earned_kes:(cents(partner.data().earned_kes)+earned)/100});
    }
   }
  }
  if(name==='reconcile_deposit')audit(tx,db,args.p_actor,'deposit.reconciled',{deposit_id:args.p_id,customer_id:d.user_id,verification_note:args.p_note});
  return null;
 });
 throw failure('Unsupported financial operation');
}
