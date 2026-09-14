# SwiftTrade backend

The workspace root contains exactly frontend/, backend/, and payments/.
Payments contains exactly MPESA-STK/ and MPESA-IPN/, each independently deployable.

Request flow:
- Browser -> main backend -> Supabase.
- Browser -> main backend -> independent STK service -> Safaricom.
- Safaricom -> independent STK or IPN service -> Supabase.
The browser has no Supabase SDK, database URL, database key or payment-service credentials.

## Run
From this folder: npm install, then npm run dev (or npm start).
Port 8787. Credentials are in .env. No .env.example is required.
The project includes Node 24 for npm scripts; deployment servers should use Node 24 LTS.

## Code layout
config/ loads server environment and clients.
routes/, controllers/, middlewares/, services/ and validators/ separate API responsibilities.
supabase/ contains SQL; scripts/ contains migrations, storage setup and verification.
archive/ contains preserved original project files.

## Database and storage
Supabase Auth and Storage are connected. The application table migration is still required.
Run npm run db:migrate after adding DATABASE_URL to .env, or run supabase/SETUP.sql
in the Supabase SQL Editor to install the complete platform schema.
Run npm run storage:setup to upload public site assets to private storage.
No credentials, browser profiles or private reference-account data are uploaded.
The additional schema models visible product features; it is not the reference site's private database.

## Security
Verified HTTP-only sessions, secure production cookies, strict CORS origins, authentication
and deposit rate limits, bounded JSON input, Helmet, safe errors and owner-scoped queries.
Money uses a service-role-only, row-locked ledger with unique receipt enforcement.
IPN notifications require independent reconciliation. STK callbacks validate checkout,
amount and phone and query Daraja before crediting. Real M-Pesa funds are KES.
Set production HTTPS, monitoring, backups, secret rotation and trusted proxy settings.
Use shared rate-limit storage when deploying multiple processes.
Trade execution, scanner automation, card/crypto/bank payouts require provider integrations.

See SETUP.md for what you need to supply.
