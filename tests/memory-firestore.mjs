// Deterministic transaction store used only by tests. Enforces Firestore's read-before-write rule.
export class MemoryFirestore {
 constructor(){this.records=new Map();this.pending=Promise.resolve();}
 collection(name){return new Query(this,name);}
 async runTransaction(fn){
  const previous=this.pending;let release;this.pending=new Promise(resolve=>{release=resolve;});await previous;
  const copy=new Map(structuredClone([...this.records]));let written=false;
  const tx={get:async target=>{if(written)throw new Error('Read after write');return target.read(copy);},set:(ref,value,options)=>{written=true;copy.set(ref.key,options?.merge?{...copy.get(ref.key),...value}:structuredClone(value));},create:(ref,value)=>{written=true;if(copy.has(ref.key))throw new Error('Already exists');copy.set(ref.key,structuredClone(value));},update:(ref,value)=>{written=true;if(!copy.has(ref.key))throw new Error('Missing document');copy.set(ref.key,{...copy.get(ref.key),...structuredClone(value)});},delete:ref=>{written=true;copy.delete(ref.key);}};
  try{const value=await fn(tx);this.records=copy;return value;}finally{release();}
 }
 put(collection,id,value){this.records.set(collection+'/'+id,structuredClone(value));}
 value(collection,id){return this.records.get(collection+'/'+id);}
}
class Ref {
 constructor(db,name,id){this.db=db;this.name=name;this.id=id;this.key=name+'/'+id;}
 read(records=this.db.records){return {id:this.id,exists:records.has(this.key),ref:this,data:()=>structuredClone(records.get(this.key))};}
 async get(){return this.read();}
}
class Query {
 constructor(db,name,filters=[]){this.db=db;this.name=name;this.filters=filters;}
 doc(id){return new Ref(this.db,this.name,id);}
 where(key,op,value){return new Query(this.db,this.name,[...this.filters,[key,op,value]]);}
 read(records=this.db.records){const docs=[];for(const [path,value]of records){if(!path.startsWith(this.name+'/'))continue;if(this.filters.every(([key,op,target])=>op==='=='?value[key]===target:op==='!='?value[key]!==target:target.includes(value[key])))docs.push(new Ref(this.db,this.name,path.slice(this.name.length+1)).read(records));}return {docs,empty:!docs.length,size:docs.length};}
 async get(){return this.read();}
}
