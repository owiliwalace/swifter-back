> Email delivery now uses EmailJS HTTPS with service service_icpioig and template template_zepk0b9. SMTP credentials are no longer used. See EMAIL.md for the required server keys and template variables.

# Firebase setup

The API uses Firebase Authentication and Cloud Firestore in project zabuni-985c6. The browser uses HTTP-only API session cookies. Firebase Admin credentials must exist only in backend/.env or the deployed server's secret environment:

- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY (quoted, with escaped newlines)
- FIREBASE_API_KEY (web project API key)
- FIREBASE_STORAGE_BUCKET

The original service account JSON was removed after Authentication and Firestore access succeeded with the environment credentials. All Firebase configuration stays in the backend environment. The frontend contains no Firebase SDK or Firebase environment variables and uses the authenticated HTTP API only.

Run `npm run firebase:init` once to create missing currencies, payment provider records and disabled-by-default referral settings. It preserves existing documents. Run `npm run firebase:check` for read-only connectivity. Run `npm test` for local regression tests. `node scripts/test-firebase.mjs` creates a disposable account and profile, verifies single-use email links, login, account APIs, admin authorization and zero-balance currency wallet creation, then removes the test records. It does not send mail.

Email/password login uses Firebase Identity Toolkit. Accounts must confirm email before API login. The server generates expiring, single-use confirmation and recovery tokens stored in _auth_actions; their messages are delivered through server-side EmailJS HTTPS. See EMAIL.md. Account creation by administrators also requires confirmation. Roles come from server-managed Firebase custom claims and suspension uses Firebase disabled accounts. Sign-out/password changes revoke refresh tokens. Re-run the existing `npm run admin:seed` with operator-supplied credentials to bootstrap an administrator; no administrator is created automatically.

Deposit credit, commissions, withdrawal reservations, unique request keys, receipt uniqueness and audit entries use Firestore transactions. KES calculations use integer minor units. Sandbox deposits cannot create cash or commissions. Influencer codes are unique and remain stable. Pending withdrawals reserve funds; rejection/cancellation returns them once. Payout completion requires processing state and a unique receipt. Do not accept raw client balance/role changes.

The M-Pesa services import the backend's shared Firebase gateway. Deploy the repository layout together, install backend dependencies, and supply the same Firebase server environment. A standalone deployment of only a payment subdirectory is not supported by this layout. Existing signed callback authorization and independent STK queries remain required.

Deploy firestore.rules to deny direct browser access to all collections. Financial and account data must be accessed through authenticated API endpoints. The frontend has no Firebase SDK module; the application keeps authentication in HTTP-only cookies. Public frontend assets are served by frontend hosting; storage:setup no longer uploads assets. Private uploads need a separate Storage integration.

Crypto deposits and real broker trading remain disabled pending provider integration. The configured settlement address is TRON, not BTC; a wallet address alone cannot verify deposits or settle trades.

Historical SMTP test status: the requested send to owiliwalace@gmail.com timed out before acceptance. DNS resolved, but TCP connections to the configured host on ports 465 and 587 timed out from this machine. Verify outbound SMTP access or supply a reachable mail provider. No test email delivery is claimed.

Validation: live disposable-account checks passed for email verification, login, account APIs, admin access boundaries and wallet creation. Firestore deny-all client rules were deployed successfully. Local regression suite: 23 tests passed. Frontend production build passed. Test email SMTP acceptance remains unconfirmed because both SMTP ports timed out.
