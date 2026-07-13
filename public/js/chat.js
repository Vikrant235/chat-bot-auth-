// chat.js
// Handles chat interface and interactions with Cohere AI and Firestore.
// Uses Firebase v10.7.1.
// Loads chat from Firestore for each signed-in user and listens for new messages.

import CohereService from './cohere-service.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const chatMessages = document.getElementById("chatMessages");
const typingIndicator = document.getElementById("typingIndicator");
const sendButton = document.getElementById("sendButton");

const cohere = new CohereService();
const auth = getAuth(window.firebaseApp);

let unsubscribeMessages = null; // To unsubscribe from realtime listener if needed

function appendMessage(content, sender = 'user') {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender === 'user' ? 'user-message' : 'ai-message'}`;
  msgDiv.innerHTML = `
    <div class="message-content">
      <p>${content}</p>
    </div>
    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
  `;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearMessages() {
  chatMessages.innerHTML = '';
}

// Load chat messages from Firestore and listen in real-time
function loadChatHistory() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    clearMessages();
    return;
  }

  // Unsubscribe previous listener to avoid multiple listeners
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  const userMessagesRef = collection(window.firebaseDb, 'users', currentUser.uid, 'messages');
  const messagesQuery = query(userMessagesRef, orderBy('timestamp'));

  clearMessages();

  unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
    // Clear and re-render all messages on each change for simplicity
    clearMessages();

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.user) {
        appendMessage(data.user, 'user');
      }
      if (data.ai) {
        appendMessage(data.ai, 'ai');
      }
    });
  }, (error) => {
    console.error("Failed to listen for chat messages:", error);
  });
}

// Enable/disable input based on Firestore readiness and auth state
const checkReadyInterval = setInterval(() => {
  if (window.firebaseDb && auth.currentUser) {
    messageInput.disabled = false;
    sendButton.disabled = false;
    clearInterval(checkReadyInterval);
  }
}, 100);

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userMessage = messageInput.value.trim();
  if (!userMessage) return;

  appendMessage(userMessage, "user");
  messageInput.value = "";
  typingIndicator.style.display = "flex";

  try {
    // Generate AI response using Cohere
    const aiResponse = await cohere.generateResponse(userMessage);
    appendMessage(aiResponse, "ai");

    // Store messages under /users/{uid}/messages
    const currentUser = auth.currentUser;
    if (!currentUser) {
      appendMessage("You must be logged in to send messages.", "ai");
      return;
    }
    const userMessagesRef = collection(window.firebaseDb, 'users', currentUser.uid, 'messages');
    await addDoc(userMessagesRef, {
      user: userMessage,
      ai: aiResponse,
      timestamp: serverTimestamp()
    });

  } catch (err) {
    console.error(err);
    appendMessage("Sorry, something went wrong.", "ai");
  } finally {
    typingIndicator.style.display = "none";
  }
});

// Listen for auth state changes to load chats or clear UI accordingly
auth.onAuthStateChanged((user) => {
  if (user) {
    loadChatHistory();
    messageInput.disabled = false;
    sendButton.disabled = false;
    // Note: UI visual toggling is now handled safely in auth.js
  } else {
    clearMessages();
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
    messageInput.disabled = true;
    sendButton.disabled = true;
    // Note: UI visual toggling is now handled safely in auth.js
  }
});


// Session ID logic is removed since we rely fully on Firestore loads now

