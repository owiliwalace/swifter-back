export function readCookie(req,name){
 const part=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='));
 try{return part?decodeURIComponent(part.slice(name.length+1)):null;}catch{return null;}
}
const options=()=>({httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/api'});
export function setSession(res,s){res.cookie('swift_access',s.access_token,{...options(),maxAge:(s.expires_in||3600)*1000});res.cookie('swift_refresh',s.refresh_token,{...options(),maxAge:604800000});}
export function clearSession(res){res.clearCookie('swift_access',options());res.clearCookie('swift_refresh',options());}