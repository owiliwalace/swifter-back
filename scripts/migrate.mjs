import {initializeDatabase} from './initialize-firebase.mjs';
import {firebaseServices} from '../config/firebase.js';
try{await initializeDatabase();console.log('Firebase catalog and settings initialized.');}
catch(error){console.error('Firebase initialization failed:',error.code||'unavailable');process.exitCode=1;}
finally{await firebaseServices().db.terminate();}
