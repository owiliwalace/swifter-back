# Crypto payments and actual trading

## Current status

Firebase Authentication and Cloud Firestore handle accounts and the financial ledger. Crypto funding and withdrawals are disabled in `config/paymentMethods.js`; opening a BTC, ETH or USDT wallet does not connect a blockchain. The chart and scanner use Deriv public market data, but cannot execute or settle contracts. Depositing KES does not fund a broker account automatically.

## What you need to supply

1. Choose a crypto payment processor that approves your business and target customers. NOWPayments is an example to evaluate, not an integration already installed. Confirm that it accepts your particular trading business before creating a production integration.
2. Obtain the merchant API key and webhook/IPN signing secret. Put secrets only in your server environment, never the frontend or a source file.
3. Choose exact assets and networks (for example, USDT on a specified network). Supply merchant settlement wallet addresses through the provider dashboard. The application does not need your seed phrase or private key.
4. Decide whether customer balances remain in crypto or convert to KES/USD, who pays network/provider fees, and how quotes expire. The existing referral ledger pays KES commissions; crypto deposits need an explicit conversion and commission policy before joining it.
5. Provide the public HTTPS backend hostname for payment callbacks, sandbox credentials, and the intended production hosting environment.
6. Decide whether payouts stay manually reviewed or use the provider payout API. Deposits and payouts require separate implementation and verification.

## Implementation required after provider selection

Create payment invoices on the server with an authenticated customer, a persisted unique order, asset/network, amount and environment. Verify webhook signatures and independently retrieve the provider payment status. Match the order, currency, received amount and final status before crediting. Handle partial, expired, duplicate and out-of-order events explicitly. Record the payment and credit the wallet exactly once in a database transaction. Keep sandbox funds separate. Add currency-aware ledger precision and reconciliation before enabling the crypto payment option.

NOWPayments documents API keys and IPN secrets in its [API overview](https://nowpayments.io/api), and signed callback verification in its [official SDK](https://github.com/NowPaymentsIO/nowpayments-sdk-nodejs). Its API has distinct partial and finished payment states; do not credit from a browser success redirect.

## Actual trading

Supply your chosen broker, approved application credentials, account authorization model, supported contracts, currencies and demo access. The integration must obtain executable quotes, submit orders, persist broker IDs, reconcile open contracts after reconnects, and settle from broker results. Payouts display as unavailable until executable broker quotes exist. Never infer wins from browser-generated prices.

For example, [Deriv's trading API](https://developers.deriv.com/docs/trading/) separates price proposals, contract purchases and open-contract status. Choosing Deriv would require implementing that lifecycle and its account authorization; it is not currently connected.

## Existing referrals

Firebase Firestore transactions manage referral attribution, deposit commissions and withdrawals. See FINANCE.md and FIREBASE.md.
