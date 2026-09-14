import {Router} from 'express';
import {requireUser} from '../middlewares/auth.js';
import {depositLimiter} from '../middlewares/security.js';
import {validateDeposit} from '../validators/payments.js';
import {createDeposit,getMethods} from '../controllers/paymentController.js';
export const paymentRoutes=Router();
paymentRoutes.get('/methods',getMethods);
paymentRoutes.post('/mpesa/stk',requireUser,depositLimiter,validateDeposit,createDeposit);