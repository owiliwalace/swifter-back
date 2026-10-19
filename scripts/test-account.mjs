import {chromium} from '../../frontend/node_modules/playwright/index.mjs';
import {admin} from '../config/database.js';
import {randomBytes} from 'node:crypto';
const stamp=Date.now(),email='swifttrade.qa.'+stamp+'@example.com',password=randomBytes(24).toString('base64url')+'aA1!';
let userId,browser;
try{
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'SwiftTrade QA '+stamp}});
 if(created.error)throw new Error(created.error.message);
 userId=created.data.user.id;console.log('Confirmed temporary QA account created.');
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const consoleErrors=[],network=[];
 page.on('pageerror',error=>consoleErrors.push(error.message));
 page.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/api/'))network.push({path:url.pathname,status:response.status()});});
 const direct=[];page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('.googleapis.com'))direct.push(request.url());});
 await page.goto('http://localhost:5173/login',{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByPlaceholder('you@example.com').fill(email);await page.getByPlaceholder('Your password').fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.waitForURL('**/trade',{timeout:30000});
 const cookies=await page.context().cookies();
 if(!cookies.find(cookie=>cookie.name==='swift_access'&&cookie.httpOnly))throw new Error('HTTP-only session cookie missing.');
 console.log('Browser login through backend and HTTP-only session: PASS');
 if(!cookies.find(cookie=>cookie.name==='swift_refresh'&&cookie.httpOnly&&cookie.expires>Date.now()/1000))throw new Error('Persistent refresh cookie missing');
 const state=await page.context().storageState();
 const restored=await browser.newContext({storageState:state});
 const restoredPage=await restored.newPage();
 await restored.clearCookies({name:'swift_access'});
 await restoredPage.goto('http://localhost:5173/wallet',{waitUntil:'domcontentloaded',timeout:60000});
 await restoredPage.getByRole('heading',{name:'Currency wallets',exact:true}).waitFor();
 let refreshed=[];
 const deadline=Date.now()+60000;
 while(Date.now()<deadline){
  refreshed=await restored.cookies();
  if(refreshed.some(cookie=>cookie.name==='swift_access'))break;
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!refreshed.some(cookie=>cookie.name==='swift_access'))throw new Error('Restored session did not refresh');
 await page.context().addCookies(refreshed);
 await restored.close();
 console.log('Session restored in new context and expired access refreshed: PASS');
 const walletResult=await page.evaluate(async()=>{
  const post=currency=>fetch('/api/wallets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currency})});
  const first=await post('USD'),second=await post('USD'),invalid=await post('INVALID');
  const list=await fetch('/api/wallets').then(r=>r.json());
  return {first:first.status,second:second.status,invalid:invalid.status,list};
 });
 if(walletResult.first!==200||walletResult.second!==200||walletResult.invalid!==400||walletResult.list.wallets.filter(w=>w.currency==='USD').length!==1)throw new Error('Currency wallet validation/idempotency failed');
 console.log('Currency wallet creation, duplicate safety and validation: PASS');
 const profile=await page.evaluate(async()=>{const response=await fetch('/api/me');return {status:response.status,body:await response.json()};});
 console.log('Profile API:',profile.status===200?'PASS':'BLOCKED â€” run npm run firebase:init');
 if(direct.length)throw new Error('Browser called the database directly.');
 if(profile.status===200){
  for(const width of [1440,1024,768,390,320]){
   await page.setViewportSize({width,height:900});
   for(const route of ['/trade','/wallet']){
    await page.goto('http://localhost:5173'+route,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(200);
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw new Error(route+' overflows at '+width);
   }
   console.log('Authenticated responsive layout:',width,'PASS');
  }
 }
 if(consoleErrors.length)throw new Error(consoleErrors.join('; '));
 console.log('Browser console errors:',consoleErrors.length);
 console.log('API network:',JSON.stringify(network));
 const logout=await page.evaluate(async()=>{const response=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});return response.status;});
 if(logout!==200)throw new Error('Logout failed.');
 const cleared=await page.context().cookies();if(cleared.some(cookie=>cookie.name==='swift_access'))throw new Error('Session cookie was not cleared.');
 console.log('Logout and no browser-to-database requests: PASS');
}catch(error){console.error('ACCOUNT TEST FAILED:',error.message);process.exitCode=1;}
finally{if(browser)await browser.close();if(userId){const result=await admin.auth.admin.deleteUser(userId);console.log('Temporary account cleanup:',result.error?'FAILED':'complete');}}




