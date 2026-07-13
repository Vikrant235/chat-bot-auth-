// firebase-config.js
// This module initializes Firebase and makes it available globally for other modules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAbELT-GOxvPOd-lf2QrNhsTDbKD18ljy0",
  authDomain: "auth-test-321.firebaseapp.com",
  projectId: "auth-test-321",
  storageBucket: "auth-test-321.firebasestorage.app",
  messagingSenderId: "692830661072",
  appId: "1:692830661072:web:a80d99f16f4fecef66b1d5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ MAKE FIREBASE AVAILABLE TO chat.js
window.firebaseApp = app;
window.firebaseDb = db;

// ✅ DEBUG LOG
console.log("firebase-config.js loaded", window.firebaseDb);
