import '../config/env.js';
import {firebaseServices} from '../config/firebase.js';
import {isTronAddress} from '../services/cryptoAddress.js';
let services;
try {
  services = firebaseServices();
  console.log('Firebase service account: valid for configured project.');
  await services.auth.listUsers(1);
  console.log('Firebase Authentication: reachable (no accounts changed).');
} catch (error) {
  console.error('Firebase Authentication check failed:', error.code || 'configuration/credentials');
  process.exitCode = 1;
}
if (services) {
  try {
    await services.db.collection('profiles').limit(1).get();
    console.log('Cloud Firestore: reachable (no documents changed).');
  } catch (error) {
    console.error('Cloud Firestore check failed:', error.code || 'unavailable');
    process.exitCode = 1;
  } finally { await services.db.terminate(); }
}
const valid = isTronAddress(process.env.CRYPTO_SETTLEMENT_ADDRESS);
console.log('Settlement address:', valid ? 'valid TRON checksum; not a Bitcoin address' : 'invalid TRON address');
if (!valid) process.exitCode = 1;
