import {sendMessage,getNotifications,getMessages} from '../controllers/supportController.js';
import { Router } from 'express';
import { requireUser } from '../middlewares/auth.js';
import {requestWithdrawal,getWithdrawals,cancelWithdrawal,getReferrals} from '../controllers/financeController.js';
import {depositLimiter} from '../middlewares/security.js';
import { getAccount, getDeposits, getPaymentInstructions } from '../controllers/accountController.js';
import {marketHistory,scanMarkets} from '../controllers/marketController.js';
export const accountRoutes = Router();
accountRoutes.use(requireUser);
accountRoutes.get('/me', getAccount);
accountRoutes.get('/market-data',marketHistory);
accountRoutes.get('/scanner',scanMarkets);
accountRoutes.get('/referrals',getReferrals);
accountRoutes.get('/withdrawals',getWithdrawals);
accountRoutes.post('/withdrawals',depositLimiter,requestWithdrawal);
accountRoutes.post('/withdrawals/:id/cancel',cancelWithdrawal);
accountRoutes.get('/payments/deposits', getDeposits);
accountRoutes.get('/payments/instructions', getPaymentInstructions);

accountRoutes.post('/support/messages',sendMessage);
accountRoutes.get('/support/messages',getMessages);
accountRoutes.get('/notifications',getNotifications);

import {getWallets,openWallet} from '../controllers/walletController.js';
accountRoutes.get('/wallets',getWallets);
accountRoutes.post('/wallets',openWallet);
