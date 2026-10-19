import {z} from 'zod';
export const adminCreateUserSchema=z.object({email:z.email().max(254),full_name:z.string().trim().min(1).max(120),password:z.string().min(8).max(128)}).strict();
export const adminProfileSchema=z.object({full_name:z.string().trim().min(1).max(120)}).strict();
export const catalogSchema=z.object({id:z.string().regex(/^[a-z0-9_-]{2,40}$/),name:z.string().trim().min(1).max(120),provider_symbol:z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).nullable(),is_active:z.boolean()}).strict();
export const adminActionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('role'),role:z.enum(['admin','user'])}).strict(),
 z.object({action:z.literal('suspend'),suspended:z.boolean()}).strict(),
 z.object({action:z.literal('support_status'),status:z.enum(['open','closed'])}).strict(),
 z.object({action:z.literal('support_reply'),message:z.string().trim().min(1).max(2000)}).strict(),
 z.object({action:z.literal('market'),enabled:z.boolean()}).strict(),
 z.object({action:z.literal('provider'),enabled:z.boolean()}).strict(),
 z.object({action:z.literal('withdrawal'),status:z.enum(['approved','rejected'])}).strict()
]);
