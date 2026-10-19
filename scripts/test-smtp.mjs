// Compatibility entry point. Email delivery now uses EmailJS over HTTPS.
if(process.argv.includes('--connect-ip'))throw new Error('--connect-ip is no longer needed. EmailJS uses HTTPS; run node scripts/test-email.mjs recipient@example.com');
await import('./test-email.mjs');
