// auth.js
// Handles Firebase authentication (Google and Email/Password) for your chat app.
// REQUIRES: firebase-config.js loaded first to initialize Firebase.

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const authUI = document.getElementById('authUI');
const userInfo = document.getElementById('userInfo');
const chatContainer = document.querySelector('.chat-container');

const auth = getAuth(window.firebaseApp);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" }); // <-- add here

function showAuthUI() {
  authUI.innerHTML = `
    <div class="login-box">
      <button id="googleSignIn" class="auth-btn">Sign in with Google</button>
      <div class="or-divider"><span>or</span></div>
      <form id="emailSignInForm" autocomplete="off" class="auth-form">
        <input type="email" id="authEmail" placeholder="Email" required autocomplete="username"/>
        <input type="password" id="authPassword" placeholder="Password" required autocomplete="current-password"/>
        <button type="submit" class="auth-btn">Sign in with Email</button>
      </form>
      <p id="authToggle" class="toggle-link">Need an account? <a href="#">Register</a></p>
      <div id="authError" class="error-message" style="display:none"></div>
    </div>
  `;

  document.getElementById('googleSignIn').onclick = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      showAuthError(err.message);
    }
  };

  let isRegister = false;
  function toggleAuthMode() {
    isRegister = !isRegister;
    const submitBtn = document.getElementById('emailSignInForm').lastElementChild;
    submitBtn.textContent = isRegister ? 'Register' : 'Sign in with Email';
    document.getElementById('authToggle').innerHTML = isRegister ?
      `Already have an account? <a href="#">Sign in</a>` :
      `Need an account? <a href="#">Register</a>`;
    clearAuthError();
  }

  document.getElementById('authToggle').onclick = e => {
    e.preventDefault();
    toggleAuthMode();
  };

  document.getElementById('emailSignInForm').onsubmit = async (e) => {
    e.preventDefault();
    clearAuthError();

    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();

    if (!email) {
      showAuthError('Please enter your email.');
      return;
    }
    if (!password) {
      showAuthError('Please enter your password.');
      return;
    }
    if (password.length < 6) {
      showAuthError('Password must be at least 6 characters.');
      return;
    }

    try {
      if (isRegister) {
        // Register user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        showAuthError('Verification email sent. Please verify your email before logging in.');
      } else {
        // Sign in user
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          await signOut(auth);
          showAuthError('Please verify your email before logging in.');
          return;
        }
        // Success: user is signed in and email verified
      }
    } catch (err) {
      handleFirebaseAuthError(err);
    }
  };

  function showAuthError(msg) {
    const errEl = document.getElementById('authError');
    errEl.textContent = msg;
    errEl.style.display = '';
  }

  function clearAuthError() {
    const errEl = document.getElementById('authError');
    errEl.textContent = '';
    errEl.style.display = 'none';
  }

  function handleFirebaseAuthError(err) {
    // Map common Firebase error codes to friendly messages
    switch (err.code) {
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        showAuthError('Incorrect email or password.');
        break;
      case 'auth/too-many-requests':
        showAuthError('Access to this account has been temporarily disabled due to many failed login attempts. Please try again later.');
        break;
      case 'auth/email-already-in-use':
        showAuthError('This email is already in use. Try signing in or use a different email.');
        break;
      case 'auth/invalid-email':
        showAuthError('The email address is not valid.');
        break;
      default:
        showAuthError(err.message || 'Authentication error occurred.');
    }
  }
}

function showUserInfo(user) {
  userInfo.innerHTML = `
    <div>
      <span>Signed in as: <b>${user.displayName || user.email}</b></span>
    </div>
    <div>
      <button id="signOutBtn" class="auth-btn">Sign Out</button>
    </div>
  `;
  document.getElementById('signOutBtn').onclick = () => signOut(auth);
}

onAuthStateChanged(auth, user => {
  if (user) {
    authUI.style.display = 'none';
    userInfo.style.display = '';
    chatContainer.style.display = '';
    showUserInfo(user);
  } else {
    authUI.style.display = '';
    userInfo.style.display = 'none';
    chatContainer.style.display = 'none';
    showAuthUI();
  }
});

export function getCurrentUser() {
  return getAuth(window.firebaseApp).currentUser;
}
