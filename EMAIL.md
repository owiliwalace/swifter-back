# EmailJS account email

Email delivery uses the EmailJS REST API over HTTPS. SMTP ports are no longer used. Firebase verification and recovery tokens are generated and checked only on the backend.

Set these variables in backend/.env and Render Environment (never in frontend VITE variables):

```dotenv
EMAILJS_SERVICE_ID=service_icpioig
EMAILJS_TEMPLATE_ID=template_zepk0b9
EMAILJS_PUBLIC_KEY=your_public_key
EMAILJS_PRIVATE_KEY=your_private_key
```

In EmailJS Account > Security, enable API requests from non-browser applications and configure private-key protection. This integration requires the private key for server requests. Select the connected sender account in the EmailJS service/template dashboard; no SMTP username/password is needed by this backend.

Configure template template_zepk0b9:

- To Email: {{to_email}}
- Subject: {{subject}}
- From Name: SwiftTrade
- From Email: the connected service's verified sender/default address
- Content: replace the template body using the HTML/code editor with the entire contents of emailjs-template.html. Save the template. The design uses existing backend variables, so no backend changes are needed for this template replacement.

The backend supplies to_email, subject, message, action_url, action_text, app_name and email_type. Keep these names exact. One template handles signup, admin invitations, password recovery and diagnostic tests. Verification links include a fragment containing the one-use token; preserve the complete URL and turn off link tracking if it changes those links.

Test after adding keys:

```sh
npm run email:test -- owiliwalace@gmail.com
```

The older node scripts/test-smtp.mjs recipient@example.com command is a compatibility alias for EmailJS; --connect-ip no longer applies. No public test-mail endpoint was added. On Render without Shell, test using the normal signup/recovery flow and inspect logs/EmailJS email history.

Service ID and template ID alone cannot send email. Restart the local backend or redeploy Render after saving the keys. The service check validates configuration only; an accepted API response does not confirm inbox delivery. Provider error bodies, keys, addresses and verification tokens are not written to server logs.

Sending is serialized per backend process to respect EmailJS's one-request-per-second API limit. Multiple backend instances sharing one EmailJS account need a shared limiter; avoid automatic retries after uncertain delivery.

References: https://www.emailjs.com/docs/rest-api/send/ and https://github.com/emailjs-com/emailjs-nodejs
