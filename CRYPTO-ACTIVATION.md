# USDT on TRON: payment activation

Selected provider: NOWPayments. Selected asset/network: USDT on TRON (provider code usdttrc20). The supplied settlement address has a valid TRON checksum. This does not verify ownership or the receiving wallet application's token support.

Current status: NOT LIVE. The operator has a wallet but no merchant account or credentials. The official NOWPayments SDK is installed. Deposit/payout endpoints, signed webhook reconciliation, exact USDT accounting and customer UI still require implementation and provider testing. Configuration placeholders do not enable payments. Keep CRYPTO_PAYMENTS_ENABLED and NOWPAYMENTS_PAYOUTS_ENABLED false until those checks pass.

Operator setup:

1. Register at https://account.nowpayments.io/ and confirm the provider supports the business and region.
2. Configure USDT on TRON and verify the settlement address in the provider dashboard.
3. Obtain the API key and IPN secret; add them as NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET in backend/.env only.
4. Set PUBLIC_API_URL to the externally reachable HTTPS backend hostname. Localhost cannot receive provider callbacks.
5. For outbound payments, enable the provider's payout/custody features and 2FA. Server authentication uses NOWPAYMENTS_EMAIL and NOWPAYMENTS_PASSWORD. Keep them in server secrets. Supply one-time 2FA codes through the eventual admin payout flow; do not paste secrets in chat.
6. Confirm funding and fee policy. A balance held in the operator's external wallet does not automatically fund the provider's custody balance. Configure/top up the provider payout balance as required.
7. Test deposits and payouts with provider sandbox credentials. Confirm the exact asset, chain, invoice amount, final status, callback signature, duplicate handling, available balances and payout authorization before production activation.

Never provide a seed phrase or wallet private key. Provider API credentials are sufficient for this integration. Do not send funds to a static wallet address expecting the application to recognize or credit them; automated crediting is not implemented yet.

Provider references: https://nowpayments.io/api and https://github.com/NowPaymentsIO/nowpayments-sdk-nodejs
