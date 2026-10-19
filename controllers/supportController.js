import {z} from 'zod';
import {admin} from '../config/database.js';
export async function sendMessage(req,res){
 const body=z.object({message:z.string().trim().min(1).max(2000)}).strict().safeParse(req.body);
 if(!body.success)return res.status(400).json({error:'Write a message of up to 2,000 characters.'});
 let conversation=await admin.from('support_conversations').select('id').eq('user_id',req.user.id).eq('status','open').order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(conversation.error)return res.status(503).json({error:'Support conversations are temporarily unavailable.'});
 if(!conversation.data)conversation=await admin.from('support_conversations').insert({user_id:req.user.id,subject:'Account support'}).select('id').single();
 if(conversation.error)return res.status(503).json({error:'Could not open a support conversation.'});
 const {data,error}=await admin.from('support_messages').insert({user_id:req.user.id,conversation_id:conversation.data.id,message:body.data.message,sender_role:'user'}).select('id,created_at').single();
 if(error)return res.status(503).json({error:'Support messaging is not ready. Apply the platform database migration.'});
 res.status(201).json({message:data});
}
export async function getMessages(req,res){
 const {data,error}=await admin.from('support_messages').select('id,message,sender_role,created_at').eq('user_id',req.user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
 if(error)return res.status(503).json({error:'Support history is temporarily unavailable.'});
 res.json({messages:data.reverse()});
}
export async function getNotifications(req,res){
 const {data,error}=await admin.from('notifications').select('id,title,body,read_at,created_at').eq('user_id',req.user.id).order('created_at',{ascending:false}).limit(50);
 if(error)return res.status(503).json({error:'Notifications are not configured.'});
 res.json({notifications:data});
}
