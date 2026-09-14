# Your setup checklist

1. Supabase: URL, anon key and service-role key are configured in server .env files.
   The frontend .env contains only VITE_API_URL.
2. Database tables: add DATABASE_URL (Supabase Connect -> Postgres connection string)
   to backend/.env, then run npm run db:migrate. Alternatively execute supabase/SETUP.sql
   in Supabase SQL Editor. No database password or management token was supplied.
3. Authentication: use your real email to sign up. Enable email/password Auth,
   configure email confirmation/SMTP, and set Site URL to your frontend.
   Allow frontend /login and /reset-password redirect URLs.
4. M-Pesa STK: fill Daraja consumer key, consumer secret, shortcode and passkey in
   payments/MPESA-STK/.env. Set its public HTTPS callback origin and approved transaction type.
5. M-Pesa IPN: fill its shortcode in payments/MPESA-IPN/.env and register that service's
   validation/confirmation HTTPS URLs with Daraja.
6. Hosting: deploy frontend, main backend, STK and IPN separately.
   Set main backend MPESA_STK_SERVICE_URL to the STK server.
   PAYMENTS_SERVICE_TOKEN must match on main backend and STK; local tokens were generated.
   Each payment server has its own .env and server-only Supabase credentials.
7. Production browser access: serve /api through the frontend's origin, or use same-site
   HTTPS subdomains and an exact ALLOWED_ORIGINS entry. Set NODE_ENV=production.
8. Other payments: Visa/Mastercard, crypto, bank transfer and other mobile money are
   selectable provisions but cannot receive funds until providers are implemented.
   Add hosted-checkout adapters, API keys, webhook verification and settlement currency rules.
   No automatic FX conversion is implemented.
9. Trading: the internal UI currently shows simulated ticks and prevents real trade execution.
   Connect an authorized market-data/trading provider and settlement engine before enabling trades.
10. Publish your own terms, privacy policy and support details before launch.
11. Rotate the service-role key shared in chat before production.

## Start locally, one terminal per service
frontend: npm run dev -> http://localhost:5173
backend: npm start -> http://localhost:8787
payments/MPESA-STK: npm run dev -> http://localhost:8788
payments/MPESA-IPN: npm run dev -> http://localhost:8789

## Reference-site login from VS Code
In frontend/, run npm run reference:login.
Sign in yourself in the separate Edge window. No password is printed or embedded in SwiftTrade.
The browser profile is excluded from Git, Vite file watching and HTTP file serving.

## Feature data
Core: profiles, deposits, wallet_entries, trades, transactions.
Additional: currencies, payment_providers, markets, contract_types, currency_wallets,
withdrawals, user_settings, bot_strategies, bot_runs, scanner_runs, notifications,
support_conversations, support_messages, referrals, documents, site_files, audit_logs,
webhook_events. SQL includes row-level security and server-only write access.
Private buckets: site-assets, avatars, support-attachments, account-documents, trade-exports.


Currency wallets are available through authenticated GET/POST /api/wallets. KES uses the existing verified M-Pesa balance. Other currencies use separate accounts with zero initial balances; opening an existing account preserves its balance. Funding requires a configured provider. No exchange or conversion is performed.

Sessions use HTTP-only cookies: access tokens expire according to the authentication session and refresh cookies persist for seven days. The frontend shares concurrent refresh requests. Use HTTPS in production and proxy /api on the frontend origin for the existing SameSite cookie configuration.

The trading sidebar remains visible on desktop and opens from Positions & session below 900px. Escape, the close button, and the backdrop dismiss it.
