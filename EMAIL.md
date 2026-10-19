# Account email

Configure only these four email settings in backend/.env:

```dotenv
SMTP_HOST=mail.swifttrade.co.ke
SMTP_PORT=465
SMTP_USER=noreply@swifttrade.co.ke
SMTP_PASS="your mailbox password"
```

SMTP_USER is also the sender address. Port 465 automatically uses SSL/TLS; port 587 automatically uses STARTTLS. Keep the existing mailbox password in the server environment; never put it in frontend variables or chat. Restart the backend after changing .env.

Test from the backend directory:

```sh
node scripts/test-smtp.mjs owiliwalace@gmail.com
```

A timeout means the server did not respond; check the hostname, network access and mail server firewall. An authentication failure means the mailbox username/password needs checking. Simplifying these settings does not fix an unreachable SMTP server. The previous connection attempt timed out before authentication, although sending from webmail worked.

Firebase manages accounts. The server sends single-use confirmation and recovery links through this SMTP connection. FRONTEND_URL separately controls the website linked in those emails.
