// auth.js
// Handles Supabase email/password authentication for the chat app.
// REQUIRES: supabase-config.js loaded first.
import { supabase } from './supabase-config.js';

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
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          if (data.user && data.session === null) {
            showAuthError('Check your email for a confirmation link to finish signing up.');
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
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
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    showAuthError('Incorrect email or password.');
  } else if (msg.includes('already registered') || msg.includes('already been registered')) {
    showAuthError('This email is already registered. Try signing in.');
  } else if (msg.includes('rate limit') || msg.includes('too many')) {
    showAuthError('Too many attempts. Please wait a moment and try again.');
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
  document.getElementById('signOutBtn').onclick = () => supabase.auth.signOut();
}

supabase.auth.onAuthStateChange((event, session) => {
  (async () => {
    const user = session?.user ?? null;
    if (user) {
      authUI.style.display = 'none';
      userInfo.style.display = '';
      chatContainer.style.display = 'flex';
      if (sidebar) sidebar.style.display = 'flex';
      showUserInfo(user);
      window.dispatchEvent(new CustomEvent('user-signed-in', { detail: user }));
    } else {
      authUI.style.display = '';
      userInfo.style.display = 'none';
      chatContainer.style.display = 'none';
      if (sidebar) sidebar.style.display = 'none';
      window.dispatchEvent(new CustomEvent('user-signed-out'));
      showAuthUI();
    }
  })();
});

export function getCurrentUser() {
  return supabase.auth.getUser();
}
