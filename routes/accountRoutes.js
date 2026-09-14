import {sendMessage,getNotifications} from '../controllers/supportController.js';
import { Router } from 'express';
import { requireUser } from '../middlewares/auth.js';
import { getAccount, getDeposits, getPaymentInstructions } from '../controllers/accountController.js';
export const accountRoutes = Router();
accountRoutes.use(requireUser);
accountRoutes.get('/me', getAccount);
accountRoutes.get('/payments/deposits', getDeposits);
accountRoutes.get('/payments/instructions', getPaymentInstructions);

accountRoutes.post('/support/messages',sendMessage);
accountRoutes.get('/notifications',getNotifications);

import {getWallets,openWallet} from '../controllers/walletController.js';
accountRoutes.get('/wallets',getWallets);
accountRoutes.post('/wallets',openWallet);
