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
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

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
