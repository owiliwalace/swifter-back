import {admin} from '../config/database.js';
import {readCookie} from './session.js';
export async function requireUser(req,res,next){
 if(!admin)return res.status(503).json({error:'Account service is not configured.'});
 const token=readCookie(req,'swift_access');if(!token)return res.status(401).json({error:'Please sign in.'});
 const {data,error}=await admin.auth.getUser(token);
 if(error||!data.user)return res.status(401).json({error:'Invalid or expired session.'});
 if(Date.parse(data.user.banned_until)>Date.now())return res.status(403).json({error:'This account is suspended.'});
 req.user=data.user;req.accessToken=token;next();
}
