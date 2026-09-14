import { z } from 'zod';
export const depositSchema = z.object({ phone: z.string().min(9).max(24), amount: z.number().int().min(1).max(150000) }).strict();
export function validateDeposit(req, res, next) {
  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide a Kenyan phone number and a whole KES amount between 1 and 150,000.' });
  req.body = parsed.data; next();
}
