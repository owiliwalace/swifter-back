import {admin} from '../config/database.js';
const tables=['profiles','deposits','wallet_entries','trades','transactions','currencies','payment_providers','markets','contract_types','currency_wallets','withdrawals','user_settings','bot_strategies','bot_runs','scanner_runs','notifications','support_conversations','support_messages','referrals','documents','site_files','audit_logs','webhook_events','referral_settings','influencers','referral_commissions'];
if(!admin){console.error('Database audit unavailable: configure the server Firebase credentials.');process.exit(1);}
const missing=[];
for(const table of tables){const {error}=await admin.from(table).select('*').limit(0);if(error)missing.push({table,code:error.code||'CONNECTION_ERROR'});}
console.log(JSON.stringify({checked:tables.length,available:tables.length-missing.length,missing},null,2));
if(missing.length)process.exitCode=1;
