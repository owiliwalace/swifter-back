import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { origins } from '../config/env.js';
export function security(app) {
  app.disable('x-powered-by');
  // Set trust proxy only after configuring a known, trusted reverse proxy.
  app.use(helmet());
  app.use(cors({ origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed.'); error.status = 403; callback(error);
  }, credentials:true, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
}
export const apiLimiter = rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false });
export const depositLimiter = rateLimit({ windowMs: 60000, limit: 3, keyGenerator: req => req.user.id, standardHeaders: 'draft-8', legacyHeaders: false });
export const callbackLimiter = rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false });
