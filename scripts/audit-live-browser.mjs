import {randomUUID,randomBytes} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {chromium,expect} from '../../frontend/node_modules/@playwright/test/index.mjs';
import {admin} from '../config/database.js';
import {firebaseServices} from '../config/firebase.js';
const {auth,db}=firebaseServices(); const ids=[];let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});mkdirSync('../frontend/artifacts',{recursive:true});
 for(const role of ['admin','user']){
 const email='browser-audit-'+randomUUID()+'@example.com',password=randomBytes(24).toString('base64url');
 const result=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role},user_metadata:{full_name:'Temporary browser audit'}});
 if(result.error)throw new Error('Account setup failed');ids.push(result.data.user.id);
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400&&!r.url().includes('/auth/')&&!r.url().endsWith('/me'))failed.push({path:new URL(r.url()).pathname,status:r.status()});});
 await page.goto('https://www.swifttrade.co.ke/login',{waitUntil:'domcontentloaded',timeout:90000});await page.getByPlaceholder('you@example.com').fill(email);await page.getByPlaceholder('Your password').fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/'+(role==='admin'?'admin':'trade'),{timeout:90000});console.log(role+' login: correct destination');
 for(const width of [1440,390]){
 await page.setViewportSize({width,height:1000});
 for(const [path,title] of [['account','My account'],['wallet','Currency wallets'],['earnings','Referral earnings'],['withdrawals','Withdraw funds'],...(role==='admin'?[['admin','Administration']]:[])]){
 await page.goto('https://www.swifttrade.co.ke/'+path,{waitUntil:'domcontentloaded',timeout:90000});await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible({timeout:30000});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);if(overflow)throw new Error(role+' '+path+' overflow '+width);
 await expect(page.getByRole('navigation',{name:'Account navigation'}).getByRole('link',{name:'Administration',exact:true})).toHaveCount(role==='admin'?1:0);
 await page.screenshot({path:'../frontend/artifacts/live-'+role+'-'+path+'-'+width+'.png',fullPage:true});console.log(role+' '+path+' '+width+': rendered, navigation and width passed');
 }
 }
 if(role==='user'){await page.goto('https://www.swifttrade.co.ke/admin',{waitUntil:'domcontentloaded'});await page.waitForURL('**/trade');console.log('Regular user admin access: redirected');}
 await page.goto('https://www.swifttrade.co.ke/trade',{waitUntil:'domcontentloaded'});await expect(page.getByRole('button',{name:'Account settings',exact:true})).toBeVisible({timeout:30000});await page.getByRole('button',{name:'Account settings',exact:true}).click();await page.waitForURL('**/account');await expect(page.getByRole('heading',{name:'My account',exact:true})).toBeVisible();await page.reload();await expect(page.getByText(email,{exact:true})).toBeVisible({timeout:30000});
 console.log(role+' session reload and trading account navigation passed');console.log(role+' JavaScript errors:',JSON.stringify(errors));console.log(role+' failed API responses:',JSON.stringify(failed));if(errors.length||failed.length)process.exitCode=1;
 await context.close();
 }
}catch(e){console.error(e.message);process.exitCode=1;}finally{await browser?.close();for(const id of ids){await db.collection('profiles').doc(id).delete();await auth.deleteUser(id);}await db.terminate();console.log('Temporary accounts removed');}
