import {randomUUID, createHash} from 'node:crypto';
import {firebaseServices} from '../config/firebase.js';
export const now=()=>new Date().toISOString();
export const identifier=(...parts)=>createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export const failure=(message,code='P0001')=>Object.assign(new Error(message),{code});
export const result=async fn=>{try{return {data:await fn(),error:null};}catch(error){return {data:null,error:{code:error.code||'unavailable',message:error.message}};}};
export const defaults=(table,row)=>({id:randomUUID(),created_at:now(),...({profiles:{wallet_kes:0,balance:10000,currency:'USD',payment_reference:'N'+randomUUID().replaceAll('-','').slice(0,11).toUpperCase()},deposits:{currency:'KES',status:'pending',environment:'unknown'},currency_wallets:{balance:'0'},influencers:{available_kes:0,earned_kes:0},support_conversations:{status:'open'},withdrawals:{status:'requested',currency:'KES'}}[table]||{}),...row});
const validTable=name=>/^[a-z][a-z_]{0,60}$/.test(name);
export class FirestoreQuery {
 constructor(table){if(!validTable(table))throw failure('Invalid collection');this.table=table;this.filters=[];this.sort=[];this.operation='read';this.columns='*';this.options={};}
 select(columns='*',options={}){this.columns=columns;this.options=options;return this;}
 eq(key,value){this.filters.push([key,'==',value]);return this;}
 neq(key,value){this.filters.push([key,'!=',value]);return this;}
 in(key,value){this.filters.push([key,'in',value]);return this;}
 order(key,{ascending=true}={}){this.sort.push([key,ascending]);return this;}
 limit(value){this.take=value;return this;}
 range(first,last){this.offset=first;this.take=last-first+1;return this;}
 single(){this.one=true;return this;}
 maybeSingle(){this.one=true;this.optional=true;return this;}
 insert(value){this.operation='insert';this.values=Array.isArray(value)?value:[value];return this;}
 update(value){this.operation='update';this.values=value;return this;}
 delete(){this.operation='delete';return this;}
 upsert(value,options={}){this.operation='upsert';this.values=Array.isArray(value)?value:[value];this.conflict=options;return this;}
 then(resolve,reject){return this.execute().then(resolve,reject);}
 async execute(){
  try{
   const {db}=firebaseServices(),collection=db.collection(this.table);
   let rows;
   if(['insert','upsert'].includes(this.operation)){
    rows=await db.runTransaction(async tx=>{
     const prepared=this.values.map(value=>{
      const row=defaults(this.table,value);
      if(this.operation==='upsert'&&this.conflict.onConflict)row.id=identifier(...this.conflict.onConflict.split(',').map(key=>row[key]));
      return row;
     });
     const snapshots=await Promise.all(prepared.map(row=>tx.get(collection.doc(String(row.id)))));
     const locks=[];
     for(const row of prepared){
      if(this.table==='deposits'&&row.receipt)locks.push({ref:db.collection('_receipts').doc(row.receipt),id:row.id});
     }
     const lockSnapshots=await Promise.all(locks.map(lock=>tx.get(lock.ref)));
     for(let i=0;i<locks.length;i++)if(lockSnapshots[i].exists&&lockSnapshots[i].data().deposit_id!==locks[i].id)throw failure('Receipt already recorded','23505');
     prepared.forEach((row,i)=>{
      if(snapshots[i].exists){if(this.operation==='insert')throw failure('Record already exists','23505');if(this.conflict.ignoreDuplicates)return;}
      tx.set(collection.doc(String(row.id)),row,{merge:this.operation==='upsert'});
     });
     locks.forEach(lock=>tx.set(lock.ref,{deposit_id:lock.id}));
     return prepared;
    });
   }else{
    const idFilter=this.filters.find(([key,op])=>key==='id'&&op==='==');
    if(idFilter){
     const doc=await collection.doc(String(idFilter[2])).get();
     rows=doc.exists?[{id:doc.id,...doc.data()}]:[];
     rows=rows.filter(row=>this.filters.every(([key,op,value])=>op==='=='?row[key]===value:op==='!='?row[key]!==value:value.includes(row[key])));
    }else{
     let query=collection;
     // Server-side filtering; local sort avoids composite-index requirements.
     for(const [key,op,value] of this.filters)query=query.where(key,op,value);
     const snapshot=await query.get();
     rows=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
    }
    const total=rows.length;
    rows.sort((a,b)=>{for(const [key,ascending] of this.sort){const n=a[key]<b[key]?-1:a[key]>b[key]?1:0;if(n)return ascending?n:-n;}return 0;});
    rows=rows.slice(this.offset||0,this.take===undefined?undefined:(this.offset||0)+this.take);
    if(this.operation!=='read'){
     rows=await db.runTransaction(async tx=>{
      const refs=rows.map(row=>collection.doc(String(row.id)));
      const current=await Promise.all(refs.map(ref=>tx.get(ref)));
      const changed=[];
      current.forEach((doc,index)=>{
       if(!doc.exists)return;
       const row=doc.data();
       if(!this.filters.every(([key,op,value])=>op==='=='?row[key]===value:op==='!='?row[key]!==value:value.includes(row[key])))return;
       if(this.operation==='delete')tx.delete(refs[index]);
       else tx.update(refs[index],this.values);
       changed.push({...row,...(this.operation==='update'?this.values:{})});
      });
      return changed;
     });
    }
    this.total=total;
   }
   if(this.one&&(rows.length>1||(!this.optional&&rows.length!==1)))throw failure('Record not found or ambiguous','PGRST116');
   const projected=rows.map(row=>this.columns==='*'?row:Object.fromEntries(this.columns.split(',').map(column=>{
    const [name,cast]=column.split('::');return [name,cast==='text'?String(row[name]??'0'):row[name]??null];
   })));
   return {data:this.options.head?null:this.one?(projected[0]||null):projected,count:this.options.count?(this.total??rows.length):undefined,error:null};
  }catch(error){return {data:null,count:null,error:{code:error.code||'unavailable',message:error.message}};}
 }
}
