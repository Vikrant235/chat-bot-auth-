// chat.js
// ChatGPT-style multi-chat logic backed by Supabase.
// Handles: chat list (sidebar), create/select/delete/rename chats,
// message loading + sending, and client-side rate-limit enforcement.

import CohereService from './cohere-service.js';
import { supabase } from './supabase-config.js';

// Limits (also enforced by database triggers — these are for UX)
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

// ---------------- Render helpers ----------------

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMessage({ content, role, created_at }) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
  const avatarLabel = role === 'user' ? 'You' : 'AI';
  msgDiv.innerHTML = `
    <div class="message-avatar">${avatarLabel}</div>
    <div class="message-bubble">
      <div class="message-content"><p>${escapeHtml(content)}</p></div>
      <div class="message-time">${formatTime(created_at)}</div>
    </div>
  `;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearMessages() {
  chatMessages.innerHTML = '';
}

// ---------------- Chat list (sidebar) ----------------

async function loadChats() {
  const { data, error } = await supabase
    .from('chats')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to load chats:', error);
    return;
  }
  chats = data || [];
  renderChatList();
  updateNewChatButtonState();

  // Auto-select the most recent chat, or show empty state
  if (chats.length > 0 && !currentChatId) {
    await selectChat(chats[0].id);
  } else if (chats.length === 0) {
    showEmptyState();
  }
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
  newChatBtn.title = atLimit ? `Limit reached: max ${MAX_CHATS} chats. Delete one to create a new chat.` : 'Start a new chat';
}

// ---------------- Chat CRUD ----------------

async function createChat() {
  if (chats.length >= MAX_CHATS) {
    showToast(`You can have at most ${MAX_CHATS} chats. Delete one first.`);
    return;
  }

  const { data, error } = await supabase
    .from('chats')
    .insert({ title: 'New Chat' })
    .select('id, title, created_at, updated_at')
    .single();

  if (error) {
    if (error.message?.includes('CHAT_LIMIT_REACHED')) {
      showToast(`Chat limit reached (${MAX_CHATS}). Delete one to start a new chat.`);
      await loadChats();
    } else {
      console.error('Failed to create chat:', error);
      showToast('Could not create chat.');
    }
    return;
  }

  chats.unshift(data);
  renderChatList();
  updateNewChatButtonState();
  await selectChat(data.id);
  autoCollapseSidebarOnMobile();
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
  const { error } = await supabase.from('chats').delete().eq('id', chatId);
  if (error) {
    console.error('Failed to delete chat:', error);
    showToast('Could not delete chat.');
    return;
  }

  chats = chats.filter((c) => c.id !== chatId);

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
}

// ---------------- Messages ----------------

async function loadMessages(chatId) {
  clearMessages();
  messageCount = 0;
  hideMessageLimitBanner();
  setInputsDisabled(false);

  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load messages:', error);
    showToast('Could not load messages.');
    return;
  }

  if (!data || data.length === 0) {
    showEmptyChatPlaceholder();
    return;
  }

  data.forEach(renderMessage);
  messageCount = data.length;
  updateMessageLimitUX();
}

async function sendMessage(text) {
  if (sending) return;
  if (!currentChatId) { await createChat(); }
  if (!currentChatId) return;
  if (messageCount >= MAX_MESSAGES_PER_CHAT) {
    showToast(`This chat is full (${MAX_MESSAGES_PER_CHAT} messages). Start a new chat.`);
    return;
  }

  sending = true;
  setInputsDisabled(true);
  typingIndicator.classList.add('show');

  // Clear any empty-state placeholder before rendering
  const placeholder = chatMessages.querySelector('.empty-state, .empty-chat-placeholder');
  if (placeholder) placeholder.remove();

  // Optimistic render
  const userMsg = { content: text, role: 'user', created_at: new Date().toISOString() };
  renderMessage(userMsg);

  try {
    // Build chat history for Cohere from loaded messages
    const history = await buildChatHistory(text);
    const aiResponse = await cohere.generateResponse(text, history);

    // Persist both messages to Supabase
    const inserts = [
      { chat_id: currentChatId, role: 'user', content: text },
      { chat_id: currentChatId, role: 'assistant', content: aiResponse },
    ];
    const { data: inserted, error } = await supabase
      .from('messages')
      .insert(inserts)
      .select('id, role, content, created_at');

    if (error) {
      if (error.message?.includes('MESSAGE_LIMIT_REACHED')) {
        showToast(`This chat reached the ${MAX_MESSAGES_PER_CHAT}-message limit.`);
        // Reload to get accurate server state
        await loadMessages(currentChatId);
      } else {
        throw error;
      }
    } else if (inserted) {
      messageCount += inserted.length;
      // Render the AI message with server timestamp
      const aiRow = inserted.find((m) => m.role === 'assistant');
      if (aiRow) renderMessage(aiRow);
      updateMessageLimitUX();
    }
  } catch (err) {
    console.error('Send failed:', err);
    renderMessage({ content: 'Sorry, something went wrong. Please try again.', role: 'ai', created_at: new Date().toISOString() });
  } finally {
    typingIndicator.classList.remove('show');
    sending = false;
    setInputsDisabled(false);
    messageInput.focus();
  }
}

async function buildChatHistory(latestUserText) {
  // Gather existing messages for Cohere chat_history format
  const existing = Array.from(chatMessages.querySelectorAll('.message'))
    .map((el) => {
      const isUser = el.classList.contains('user-message');
      const text = el.querySelector('.message-content p')?.textContent || '';
      return { role: isUser ? 'USER' : 'CHATBOT', message: text };
    })
    .filter((m) => m.message);
  // The latest user message is passed as `message` to Cohere, not in history
  return existing.filter((m) => m.message !== latestUserText);
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

// ---------------- Event wiring ----------------

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || sending) return;
  messageInput.value = '';
  sendMessage(text);
});

newChatBtn?.addEventListener('click', createChat);

// Sidebar toggle (desktop + mobile)
const sidebar = document.querySelector('.chat-sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');

function toggleSidebar() { sidebar?.classList.toggle('collapsed'); }
sidebarToggle?.addEventListener('click', toggleSidebar);
mobileMenuBtn?.addEventListener('click', toggleSidebar);

// On mobile, collapse sidebar when a chat is selected
function autoCollapseSidebarOnMobile() {
  if (window.innerWidth <= 768) sidebar?.classList.add('collapsed');
}

// Auth state
window.addEventListener('user-signed-in', () => {
  setInputsDisabled(false);
  loadChats();
});

window.addEventListener('user-signed-out', () => {
  currentChatId = null;
  chats = [];
  messageCount = 0;
  clearMessages();
  renderChatList();
  setInputsDisabled(true);
  if (chatTitle) chatTitle.textContent = 'AI Chatbot';
  hideMessageLimitBanner();
});

// Enable input once signed in (safety check)
const readyCheck = setInterval(() => {
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      setInputsDisabled(false);
      clearInterval(readyCheck);
    }
  });
}, 300);
