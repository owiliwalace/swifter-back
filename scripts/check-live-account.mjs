import {app} from '../app.js';
let input='';for await(const chunk of process.stdin)input+=chunk;
const credentials=JSON.parse(input);
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
let cookie='';
try{
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});
 if(!login.ok)throw new Error('Login verification failed: '+login.status);
 cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 console.log('Backend password login and session cookies verified.');
 for(const endpoint of ['/me','/wallets','/payments/deposits','/referrals','/withdrawals','/admin/users','/admin/system','/scanner']){
  const response=await fetch(base+'/api'+endpoint,{headers:{Cookie:cookie},signal:AbortSignal.timeout(30000)});
  console.log(endpoint,response.status);
  if(!response.ok)process.exitCode=1;
 }
}catch(error){console.log(error.message);process.exitCode=1;}finally{
 if(cookie)await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'}).catch(()=>{});
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
