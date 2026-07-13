// auth.js
// Handles Firebase email/password authentication for the chat app.
// REQUIRES: firebase-config.js loaded first.

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { firebaseAuth } from './firebase-config.js';

const authUI = document.getElementById('authUI');
const userInfo = document.getElementById('userInfo');
const chatContainer = document.querySelector('.chat-container');
const sidebar = document.querySelector('.chat-sidebar');

let isRegister = false;

function showAuthUI() {
  authUI.innerHTML = `
    <div class="login-box">
      <div class="auth-logo">
        <span class="auth-logo-icon">AI</span>
      </div>
      <h2 class="auth-title">${isRegister ? 'Create account' : 'Welcome back'}</h2>
      <p class="auth-subtitle">${isRegister ? 'Sign up to start chatting' : 'Sign in to continue your chats'}</p>
      <form id="emailSignInForm" autocomplete="off" class="auth-form">
        <input type="email" id="authEmail" placeholder="Email" required autocomplete="username"/>
        <input type="password" id="authPassword" placeholder="Password" required autocomplete="current-password"/>
        <button type="submit" class="auth-btn">${isRegister ? 'Sign up' : 'Sign in'}</button>
      </form>
      <p id="authToggle" class="toggle-link">${isRegister ? 'Already have an account? <a href="#">Sign in</a>' : 'Need an account? <a href="#">Sign up</a>'}</p>
      <div id="authError" class="error-message" style="display:none"></div>
    </div>
  `;
  bindAuthForm();
}

function bindAuthForm() {
  const toggleEl = document.getElementById('authToggle');
  if (toggleEl) {
    toggleEl.onclick = e => {
      e.preventDefault();
      isRegister = !isRegister;
      showAuthUI();
    };
  }

  const form = document.getElementById('emailSignInForm');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      clearAuthError();

      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value.trim();

      if (!email) { showAuthError('Please enter your email.'); return; }
      if (!password) { showAuthError('Please enter your password.'); return; }
      if (password.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Please wait...';

      try {
        if (isRegister) {
          await createUserWithEmailAndPassword(firebaseAuth, email, password);
        } else {
          await signInWithEmailAndPassword(firebaseAuth, email, password);
        }
      } catch (err) {
        handleAuthError(err);
        submitBtn.disabled = false;
        submitBtn.textContent = isRegister ? 'Sign up' : 'Sign in';
      }
    };
  }
}

function showAuthError(msg) {
  const errEl = document.getElementById('authError');
  if (errEl) { errEl.textContent = msg; errEl.style.display = ''; }
}

function clearAuthError() {
  const errEl = document.getElementById('authError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
}

function handleAuthError(err) {
  const code = err.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    showAuthError('Incorrect email or password.');
  } else if (code === 'auth/email-already-in-use') {
    showAuthError('This email is already registered. Try signing in.');
  } else if (code === 'auth/too-many-requests') {
    showAuthError('Too many attempts. Please wait a moment and try again.');
  } else if (code === 'auth/invalid-email') {
    showAuthError('That email address looks invalid.');
  } else if (code === 'auth/weak-password') {
    showAuthError('Password should be at least 6 characters.');
  } else if (code === 'auth/network-request-failed') {
    showAuthError('Network error. Check your connection and try again.');
  } else if (code === 'auth/api-key-not-valid' || code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' || code === 'auth/internal-error') {
    showAuthError('Firebase is not configured. Add your project credentials in js/firebase-config.js.');
  } else {
    showAuthError(err.message || 'Authentication error occurred.');
  }
}

function showUserInfo(user) {
  const initials = (user.email || 'U').substring(0, 2).toUpperCase();
  userInfo.innerHTML = `
    <div class="user-info-content">
      <div class="user-avatar">${initials}</div>
      <div class="user-info-text">
        <div class="user-info-email">${user.email}</div>
        <div class="user-info-status">Online</div>
      </div>
      <button id="signOutBtn" class="sign-out-btn" title="Sign out">Sign out</button>
    </div>
  `;
  document.getElementById('signOutBtn').onclick = () => signOut(firebaseAuth);
}

onAuthStateChanged(firebaseAuth, (user) => {
  if (user) {
    authUI.style.display = 'none';
    userInfo.style.display = '';
    chatContainer.style.display = 'flex';
    if (sidebar) sidebar.style.display = 'flex';
    showUserInfo(user);
    window.dispatchEvent(new CustomEvent('user-signed-in', { detail: { uid: user.uid, email: user.email } }));
  } else {
    authUI.style.display = '';
    userInfo.style.display = 'none';
    chatContainer.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    window.dispatchEvent(new CustomEvent('user-signed-out'));
    showAuthUI();
  }
});
