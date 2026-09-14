import { admin } from '../config/supabase.js';
export async function getAccount(req, res) {
  const { data, error } = await admin.from('profiles').select('id,full_name,balance,currency,wallet_kes,payment_reference').eq('id', req.user.id).single();
  if (error) return res.status(503).json({ error: 'Profile is unavailable. Check the database setup.' });
  res.json({ profile: data });
}
export async function getDeposits(req, res) {
  const { data, error } = await admin.from('deposits').select('id,amount,currency,channel,status,receipt,created_at').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error('Deposit lookup failed.');
  res.json({ deposits: data });
}
export function getPaymentInstructions(_req, res) {
  res.json({ shortcode: process.env.MPESA_SHORTCODE || null, environment: process.env.MPESA_ENV || 'sandbox' });
}
