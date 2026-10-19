import {z} from 'zod';
const money=z.number().finite().positive().max(150000).refine(value=>Math.abs(value*100-Math.round(value*100))<1e-7,'Use at most two decimal places.');
export const withdrawalSchema=z.object({amount:money,phone:z.string().regex(/^254[17]\d{8}$/),source:z.enum(['wallet','commission']),request_key:z.uuid()}).strict();
export const referralSettingsSchema=z.object({enabled:z.boolean(),rate:z.number().min(0).max(100).multipleOf(.01),first_deposit_only:z.boolean(),min_withdrawal:money}).strict();
export const influencerSchema=z.object({user_id:z.uuid(),code:z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/),enabled:z.boolean(),rate:z.number().min(0).max(100).multipleOf(.01).nullable()}).strict();
export const reviewSchema=z.object({status:z.enum(['approved','processing','completed','rejected']),receipt:z.string().regex(/^[A-Z0-9]{8,20}$/).optional(),note:z.string().trim().max(500).optional()}).strict().refine(body=>body.status!=='completed'||!!body.receipt,'A payout receipt is required.');
export const uuidSchema=z.uuid();
export const reconciliationSchema=z.object({user_id:z.uuid(),receipt:z.string().regex(/^[A-Z0-9]{8,20}$/),note:z.string().trim().min(10).max(500),verified:z.literal(true)}).strict();
