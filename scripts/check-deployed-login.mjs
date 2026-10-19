import {randomUUID,randomBytes} from 'node:crypto';
import {chromium} from '../../frontend/node_modules/@playwright/test/index.mjs';
import {admin} from '../config/database.js';
import {firebaseServices} from '../config/firebase.js';
const {auth,db}=firebaseServices();
let id,browser;
try{
 const email='login-check-'+randomUUID()+'@example.com',password=randomBytes(24).toString('base64url');
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role:'admin'},user_metadata:{full_name:'Temporary deployed login check'}});
 if(created.error)throw new Error('Test account setup failed: '+created.error.code);id=created.data.user.id;
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();
 const requests=[],blocked=[];
 const session=await page.context().newCDPSession(page);await session.send('Network.enable');
 session.on('Network.responseReceivedExtraInfo',event=>{for(const cookie of event.blockedCookies||[])blocked.push(cookie.blockedReasons);});
 page.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/api/'))requests.push({endpoint:url.origin+url.pathname,status:response.status()});});
 await page.goto('https://www.swifttrade.co.ke/login',{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByPlaceholder('you@example.com').fill(email);
 await page.getByPlaceholder('Your password').fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.waitForURL(url=>['/admin','/trade'].includes(url.pathname),{timeout:90000});
 await page.waitForTimeout(5000);
 console.log('Live API requests:',JSON.stringify(requests));
 console.log('Stored session cookie metadata:',JSON.stringify((await page.context().cookies()).filter(cookie=>cookie.name.startsWith('swift_')).map(({name,domain,path,sameSite,secure,httpOnly})=>({name,domain,path,sameSite,secure,httpOnly}))));
 console.log('Browser cookie rejection reasons:',JSON.stringify(blocked));
 const required=await page.getByText('Please sign in.',{exact:true}).count()>0;
 console.log('Sign-in required displayed:',required);
 const me=await page.evaluate(async()=>{const response=await fetch('/api/me');const body=await response.json();return {status:response.status,is_admin:body.profile?.is_admin};});
 console.log('Same-origin account response:',JSON.stringify(me));
 if(required||me.status!==200||me.is_admin!==true)process.exitCode=1;
 let accountReady=false;
 for(let attempt=0;attempt<3;attempt++){
  await page.goto('https://www.swifttrade.co.ke/account',{waitUntil:'domcontentloaded',timeout:90000});
  try{await page.getByRole('heading',{name:'My account',exact:true}).waitFor({timeout:10000});accountReady=true;break;}catch{/* A new Vercel deployment may still be propagating. */}
 }
 if(!accountReady)throw new Error('New account page is not deployed yet.');
 const ownEmailVisible=await page.getByText(email,{exact:true}).count()>0;
 console.log('Live account page:',JSON.stringify({ready:accountReady,emailVisible:ownEmailVisible,adminNavigation:await page.getByRole('navigation',{name:'Account navigation'}).getByRole('link',{name:'Administration',exact:true}).count()===1}));
 await page.setViewportSize({width:390,height:1000});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
 console.log('Live mobile account layout overflows:',overflow);
 if(!ownEmailVisible||overflow)process.exitCode=1;
}catch(error){console.error('Live login check:',error.code||error.message);process.exitCode=1;}
finally{await browser?.close();if(id){await db.collection('profiles').doc(id).delete();await auth.deleteUser(id);}await db.terminate();console.log('Temporary login test account cleaned up.');}
