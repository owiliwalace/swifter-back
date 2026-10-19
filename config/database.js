import {FirestoreQuery,result} from '../services/firestoreRepository.js';
import {firebaseAuthAdmin} from '../services/firebaseAuth.js';
import {financialAction} from '../services/firebaseFinance.js';
// Backend-only gateway. Browser callers never receive these credentials.
export const admin={
 from:table=>new FirestoreQuery(table),
 rpc:(name,args)=>result(()=>financialAction(name,args)),
 auth:firebaseAuthAdmin,
};
