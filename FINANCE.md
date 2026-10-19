# Referral finance

Firebase Firestore transactions record production deposits, full wallet credits, influencer commissions, withdrawal reservations, receipts and audit logs. Referral attribution is created at signup from an enabled influencer code; codes cannot be changed once assigned. Configure the referral program and assign codes through /admin. The initial program is disabled, rate 0%, minimum withdrawal KES 100.

Sandbox deposits never earn cash or commissions. Duplicate receipts and request keys cannot credit twice. First-deposit and custom-rate policies apply to future credits. Withdrawals reserve funds immediately; cancellation/rejection refunds once. Administrators approve then process then complete a payout with a unique verified receipt. Legacy or unmatched direct deposits require independent merchant reconciliation.

See FIREBASE.md. Real payouts remain manually executed outside the app and reviewed by an administrator. Crypto funding and broker trading are not connected.

## Influencer invitations
Public signup requires an enabled influencer code (3–32 letters, numbers, underscores or hyphens). Administrators assign and activate codes using the influencer controls. Share `/signup?ref=CODE`; the signup form fills the code automatically and remembers it in the current browser tab until signup succeeds. The backend validates the code and stores attribution transactionally with the new profile.

The referral earnings page provides copy-code, copy-link and WhatsApp sharing, balances, commission history, and separately paginated attributed signups. The authenticated influencer can see only their own referrals, including display names, account references and the code used; contact details are not exposed. Existing accounts are unaffected by the new signup requirement.
