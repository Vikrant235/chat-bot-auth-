// firebase-config.js
// Initializes Firebase and makes it available globally for other modules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAbELT-GOxvPOd-lf2QrNhsTDbKD18ljy0",
  authDomain: "auth-test-321.firebaseapp.com",
  projectId: "auth-test-321",
  storageBucket: "auth-test-321.firebasestorage.app",
  messagingSenderId: "692830661072",
  appId: "1:692830661072:web:a80d99f16f4fecef66b1d5"
};;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Keep the user signed in across reloads
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Could not set auth persistence:', err);
});

window.firebaseApp = app;
window.firebaseDb = db;
window.firebaseAuth = auth;

console.log('firebase-config.js loaded');
