import {admin} from '../config/supabase.js';
import {readCookie} from './session.js';
export async function requireUser(req,res,next){
 if(!admin)return res.status(503).json({error:'Account service is not configured.'});
 const token=readCookie(req,'swift_access');if(!token)return res.status(401).json({error:'Please sign in.'});
 const {data,error}=await admin.auth.getUser(token);
 if(error||!data.user)return res.status(401).json({error:'Invalid or expired session.'});
 req.user=data.user;req.accessToken=token;next();
}