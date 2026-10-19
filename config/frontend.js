export function frontendOrigin(env=process.env){
 const configured=(env.FRONTEND_URL||'').trim();
 const fallback=env.NODE_ENV==='production'?'https://www.swifttrade.co.ke':'http://localhost:5173';
 const url=new URL(configured||fallback);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('FRONTEND_URL must be a frontend origin without a path.');
 if(env.NODE_ENV==='production'&&(url.protocol!=='https:'||['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Production FRONTEND_URL must use the live HTTPS frontend.');
 return url.origin;
}
