import './env.js';
import {cert, getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
let services;
export function firebaseServices() {
  if (services) return services;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replaceAll('\\n', '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase server environment credentials are incomplete.');
  const app = getApps().find(item => item.name === 'swifttrade-server') || initializeApp({
    credential: cert({projectId, clientEmail, privateKey}), projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  }, 'swifttrade-server');
  services = {app, auth: getAuth(app), db: getFirestore(app)};
  return services;
}
