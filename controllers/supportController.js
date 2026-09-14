import {z} from 'zod';
import {admin} from '../config/supabase.js';
export async function sendMessage(req,res){
 const body=z.object({message:z.string().trim().min(1).max(2000)}).strict().safeParse(req.body);
 if(!body.success)return res.status(400).json({error:'Write a message of up to 2,000 characters.'});
 const {data,error}=await admin.from('support_messages').insert({user_id:req.user.id,message:body.data.message,sender_role:'user'}).select('id,created_at').single();
 if(error)return res.status(503).json({error:'Support messaging is not ready. Apply the platform database migration.'});
 res.status(201).json({message:data});
}
export async function getNotifications(req,res){
 const {data,error}=await admin.from('notifications').select('id,title,body,read_at,created_at').eq('user_id',req.user.id).order('created_at',{ascending:false}).limit(50);
 if(error)return res.status(503).json({error:'Notifications are not configured.'});
 res.json({notifications:data});
}