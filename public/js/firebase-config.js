// firebase-config.js
// This module initializes Firebase and makes it available globally for other modules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ MAKE FIREBASE AVAILABLE TO chat.js
window.firebaseApp = app;
window.firebaseDb = db;

// ✅ DEBUG LOG
console.log("firebase-config.js loaded", window.firebaseDb);
