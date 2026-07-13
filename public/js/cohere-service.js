// cohere-service.js
// Handles interactions with the Cohere AI Chat API.
// Refactored to accept per-chat conversation history for multi-chat support.
export default class CohereService {
  constructor() {
    this.apiKey = 'cohere_efjRTjSAFvxFiKwFoeQjH42l2685sPqaNRGIPmq93OGJT3'; // <-- Add your Cohere Trial API key here
    this.apiUrl = 'https://api.cohere.ai/v1/chat';
  }

  async generateResponse(userMessage, chatHistory = []) {
    if (!this.apiKey) {
      return 'Demo mode: add your Cohere API key in cohere-service.js to enable real AI responses. Your messages are still saved to chat history.';
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'command-a-03-2025',
        message: userMessage,
        chat_history: chatHistory,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.text?.trim();

    if (!aiResponse) throw new Error('No response generated');

    return aiResponse;
  }
}
