# Administration

Firebase custom claims control administrator access. Use npm run admin:seed with operator-supplied credentials to initialize an administrator. Credentials are never printed. Administrators can view the directory, manage roles and suspension, create accounts that require email confirmation, edit display names, manage markets, configure influencer codes and commissions, and review withdrawals. User deletion disables authentication and retains records; accounts with financial history remain suspended.

See FIREBASE.md for deployment and tests. Account confirmation emails use EmailJS HTTPS. See EMAIL.md for keys and template setup.
