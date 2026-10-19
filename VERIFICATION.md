# SwiftTrade backend

The backend uses Firebase Authentication and Cloud Firestore. See [FIREBASE.md](FIREBASE.md) for credentials, setup, transaction behavior, deployment and verification.

Install dependencies with npm install, initialize missing catalog documents with npm run firebase:init, check access with npm run firebase:check, run npm test, and start with npm start. Deploy frontend and backend with the configured HTTPS frontend origin and API proxy. Keep .env files and service account credentials private.

No live broker or crypto processor is connected. SMTP connectivity must be verified before users can receive confirmation and recovery links.
