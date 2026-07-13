// chat.js
// ChatGPT-style multi-chat logic backed by Firebase Firestore.
// Handles: chat list (sidebar), create/select/delete chats,
// message loading + sending, and client-side rate-limit enforcement.
// Data structure: users/{uid}/chats/{chatId} -> { title, createdAt, updatedAt }
//                 users/{uid}/chats/{chatId}/messages/{msgId} -> { role, content, createdAt }

import CohereService from './cohere-service.js';
import { firebaseAuth } from './firebase-config.js';

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { firebaseDb } from './firebase-config.js';

// Limits (client-enforced — Firestore has no triggers, so this is the enforcement layer)
const MAX_CHATS = 5;
const MAX_MESSAGES_PER_CHAT = 20;

const cohere = new CohereService();

// DOM references
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const chatMessages = document.getElementById('chatMessages');
const typingIndicator = document.getElementById('typingIndicator');
const sendButton = document.getElementById('sendButton');
const newChatBtn = document.getElementById('newChatBtn');
const chatList = document.getElementById('chatList');
const chatTitle = document.getElementById('currentChatTitle');
const messageLimitBanner = document.getElementById('messageLimitBanner');
const chatLimitNote = document.getElementById('chatLimitNote');

// State
let currentChatId = null;
let chats = [];
let messageCount = 0;
let sending = false;
let currentUid = null;
let messageUnsub = null;
let chatUnsub = null;
let liveMessages = [];

// ---------------- Render helpers ----------------

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function formatTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMessage({ content, role, createdAt }) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
  const avatarLabel = role === 'user' ? 'You' : 'AI';
  msgDiv.innerHTML = `
    <div class="message-avatar">${avatarLabel}</div>
    <div class="message-bubble">
      <div class="message-content"><p>${escapeHtml(content)}</p></div>
      <div class="message-time">${formatTime(createdAt)}</div>
    </div>
  `;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearMessages() {
  chatMessages.innerHTML = '';
}

// ---------------- Chat list (sidebar) ----------------

function chatsRef(uid) {
  return collection(firebaseDb, 'users', uid, 'chats');
}

function messagesRef(uid, chatId) {
  return collection(firebaseDb, 'users', uid, 'chats', chatId, 'messages');
}

function loadChats(uid) {
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }

  const q = query(chatsRef(uid), orderBy('updatedAt', 'desc'));
  chatUnsub = onSnapshot(q, (snapshot) => {
    chats = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderChatList();
    updateNewChatButtonState();

    // Auto-select the most recent chat if none selected
    if (chats.length > 0 && !currentChatId) {
      selectChat(chats[0].id);
    } else if (chats.length === 0) {
      showEmptyState();
    }
  }, (err) => {
    console.error('Failed to listen to chats:', err);
    showToast('Could not load chats. Check your Firebase configuration.');
  });
}

function renderChatList() {
  chatList.innerHTML = '';
  if (chats.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'chat-list-empty';
    empty.textContent = 'No chats yet';
    chatList.appendChild(empty);
    return;
  }

  chats.forEach((chat) => {
    const item = document.createElement('div');
    item.className = 'chat-list-item' + (chat.id === currentChatId ? ' active' : '');
    item.dataset.chatId = chat.id;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'chat-list-title';
    titleSpan.textContent = chat.title || 'New Chat';
    item.appendChild(titleSpan);

    const delBtn = document.createElement('button');
    delBtn.className = 'chat-list-delete';
    delBtn.innerHTML = '&times;';
    delBtn.title = 'Delete chat';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteChat(chat.id); };
    item.appendChild(delBtn);

    item.onclick = () => selectChat(chat.id);
    chatList.appendChild(item);
  });

  if (chatLimitNote) {
    chatLimitNote.textContent = `${chats.length}/${MAX_CHATS} chats used`;
  }
}

function updateNewChatButtonState() {
  if (!newChatBtn) return;
  const atLimit = chats.length >= MAX_CHATS;
  newChatBtn.disabled = atLimit;
  newChatBtn.title = atLimit
    ? `Limit reached: max ${MAX_CHATS} chats. Delete one to create a new chat.`
    : 'Start a new chat';
}

// ---------------- Chat CRUD ----------------

async function createChat() {
  if (!currentUid) return;
  if (chats.length >= MAX_CHATS) {
    showToast(`You can have at most ${MAX_CHATS} chats. Delete one first.`);
    return;
  }

  try {
    const docRef = await addDoc(chatsRef(currentUid), {
      title: 'New Chat',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // The onSnapshot listener will pick up the new chat and auto-select it
    currentChatId = docRef.id;
  } catch (err) {
    console.error('Failed to create chat:', err);
    showToast('Could not create chat. Check your Firebase configuration.');
  }
}

async function selectChat(chatId) {
  if (currentChatId === chatId) return;
  currentChatId = chatId;

  const chat = chats.find((c) => c.id === chatId);
  if (chatTitle) chatTitle.textContent = chat?.title || 'New Chat';

  renderChatList();
  await loadMessages(chatId);
  autoCollapseSidebarOnMobile();
}

async function deleteChat(chatId) {
  if (!currentUid) return;

  try {
    // Delete all messages in the subcollection first
    const msgsSnap = await getDocs(messagesRef(currentUid, chatId));
    const deletes = msgsSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletes);

    // Then delete the chat document
    await deleteDoc(doc(firebaseDb, 'users', currentUid, 'chats', chatId));

    if (currentChatId === chatId) {
      currentChatId = null;
      clearMessages();
      if (chats.length > 0) {
        await selectChat(chats[0].id);
      } else {
        showEmptyState();
      }
    }
    renderChatList();
    updateNewChatButtonState();
  } catch (err) {
    console.error('Failed to delete chat:', err);
    showToast('Could not delete chat.');
  }
}

// ---------------- Messages ----------------

function loadMessages(chatId) {
  if (messageUnsub) { messageUnsub(); messageUnsub = null; }

  clearMessages();
  messageCount = 0;
  liveMessages = [];
  hideMessageLimitBanner();
  setInputsDisabled(false);

  const q = query(messagesRef(currentUid, chatId), orderBy('createdAt', 'asc'));
  messageUnsub = onSnapshot(q, (snapshot) => {
    clearMessages();
    liveMessages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    messageCount = liveMessages.length;

    if (liveMessages.length === 0) {
      showEmptyChatPlaceholder();
      return;
    }

    liveMessages.forEach(renderMessage);
    updateMessageLimitUX();
  }, (err) => {
    console.error('Failed to listen to messages:', err);
    showToast('Could not load messages.');
  });
}

async function sendMessage(text) {
  if (sending || !currentChatId || !currentUid) return;
  if (messageCount >= MAX_MESSAGES_PER_CHAT) {
    showToast(`This chat is full (${MAX_MESSAGES_PER_CHAT} messages). Start a new chat.`);
    return;
  }

  sending = true;
  setInputsDisabled(true);
  typingIndicator.classList.add('show');

  // Clear any placeholder before rendering
  const placeholder = chatMessages.querySelector('.empty-state, .empty-chat-placeholder');
  if (placeholder) placeholder.remove();

  try {
    // Build chat history for Cohere from loaded messages
    const history = buildChatHistory();
    const aiResponse = await cohere.generateResponse(text, history);

    // Save the user message
    await addDoc(messagesRef(currentUid, currentChatId), {
      role: 'user',
      content: text,
      createdAt: serverTimestamp(),
    });

    // Save the AI message
    await addDoc(messagesRef(currentUid, currentChatId), {
      role: 'assistant',
      content: aiResponse,
      createdAt: serverTimestamp(),
    });

    // Touch the chat's updatedAt so it bubbles to the top of the sidebar
    await updateDoc(doc(firebaseDb, 'users', currentUid, 'chats', currentChatId), {
      updatedAt: serverTimestamp(),
    });

    // The onSnapshot listener will render both messages and update messageCount
  } catch (err) {
    console.error('Send failed:', err);
    showToast('Could not send message. Please try again.');
  } finally {
    typingIndicator.classList.remove('show');
    sending = false;
    setInputsDisabled(false);
    messageInput.focus();
  }
}

function buildChatHistory() {
  // Cohere expects { role: 'USER'|'CHATBOT', message: string }
  return liveMessages.map((m) => ({
    role: m.role === 'user' ? 'USER' : 'CHATBOT',
    message: m.content,
  }));
}

function updateMessageLimitUX() {
  const remaining = MAX_MESSAGES_PER_CHAT - messageCount;
  if (remaining <= 5 && remaining > 0) {
    showMessageLimitBanner(`Approaching limit: ${remaining} message${remaining === 1 ? '' : 's'} left in this chat.`);
  } else if (remaining <= 0) {
    showMessageLimitBanner(`This chat is full (${MAX_MESSAGES_PER_CHAT} messages). Start a new chat to continue.`);
    setInputsDisabled(true);
  } else {
    hideMessageLimitBanner();
  }
}

function showEmptyState() {
  clearMessages();
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <div class="empty-state-icon">AI</div>
    <h2>Start a conversation</h2>
    <p>Click "New chat" to begin chatting with the AI assistant.</p>
  `;
  chatMessages.appendChild(div);
  if (chatTitle) chatTitle.textContent = 'AI Chatbot';
  hideMessageLimitBanner();
}

function showEmptyChatPlaceholder() {
  clearMessages();
  const div = document.createElement('div');
  div.className = 'empty-chat-placeholder';
  div.innerHTML = `
    <div class="empty-state-icon small">AI</div>
    <p>Send a message to start this chat.</p>
  `;
  chatMessages.appendChild(div);
}

function setInputsDisabled(disabled) {
  messageInput.disabled = disabled;
  sendButton.disabled = disabled;
}

function showMessageLimitBanner(msg) {
  if (messageLimitBanner) {
    messageLimitBanner.textContent = msg;
    messageLimitBanner.style.display = '';
  }
}

function hideMessageLimitBanner() {
  if (messageLimitBanner) messageLimitBanner.style.display = 'none';
}

// ---------------- Toast ----------------

let toastTimer = null;
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ---------------- Sidebar toggle ----------------

const sidebar = document.querySelector('.chat-sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');

function toggleSidebar() { sidebar?.classList.toggle('collapsed'); }
sidebarToggle?.addEventListener('click', toggleSidebar);
mobileMenuBtn?.addEventListener('click', toggleSidebar);

function autoCollapseSidebarOnMobile() {
  if (window.innerWidth <= 768) sidebar?.classList.add('collapsed');
}

// ---------------- Event wiring ----------------

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || sending) return;
  messageInput.value = '';
  sendMessage(text);
});

newChatBtn?.addEventListener('click', createChat);

window.addEventListener('user-signed-in', (e) => {
  currentUid = e.detail.uid;
  setInputsDisabled(false);
  loadChats(currentUid);
});

window.addEventListener('user-signed-out', () => {
  if (messageUnsub) { messageUnsub(); messageUnsub = null; }
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  currentUid = null;
  currentChatId = null;
  chats = [];
  liveMessages = [];
  messageCount = 0;
  clearMessages();
  renderChatList();
  setInputsDisabled(true);
  if (chatTitle) chatTitle.textContent = 'AI Chatbot';
  hideMessageLimitBanner();
});
