import test from 'node:test';
import assert from 'node:assert/strict';
import {depositSchema} from '../validators/payments.js';
import {readCookie} from '../middlewares/session.js';
import {paymentMethods} from '../config/paymentMethods.js';
test('strict amounts and ownership injection rejected',()=>{
 for(const body of [{phone:'0712345678',amount:1.2},{phone:'0712345678',amount:-1},{phone:'0712345678',amount:100,user_id:'other'},{phone:'0712345678',amount:'10'}])assert.equal(depositSchema.safeParse(body).success,false);
 assert.equal(depositSchema.safeParse({phone:'0712345678',amount:100}).success,true);
});
test('malformed cookie cannot crash authentication',()=>{assert.equal(readCookie({headers:{cookie:'swift_access=%E0%A4%A'}},'swift_access'),null);});
test('unconfigured future payment methods are disabled',()=>{for(const method of paymentMethods().filter(item=>item.id!=='mpesa'))assert.equal(method.enabled,false);});
test('HTTP protections and cross-origin rejection',async()=>{
 const {app}=await import('../app.js');const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
 let res=await fetch(base+'/api/health');assert.equal(res.status,200);assert.equal(res.headers.get('x-content-type-options'),'nosniff');assert.equal(res.headers.get('x-powered-by'),null);
 res=await fetch(base+'/api/health',{headers:{Origin:'https://untrusted.example'}});assert.equal(res.status,403);
 res=await fetch(base+'/api/me');assert.equal(res.status,401);
 res=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(res.status,400);
 res=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:'x'.repeat(40000)})});assert.equal(res.status,413);
 res=await fetch(base+'/api/payments/methods');assert.equal(res.status,200);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
