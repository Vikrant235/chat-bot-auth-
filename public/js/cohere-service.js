// Cohere-Service.js
// This module handles interactions with the Cohere AI API for generating responses using the Chat API.
export default class CohereService {
    constructor() {
        this.apiKey = 'cohere_efjRTjSAFvxFiKwFoeQjH42l2685sPqaNRGIPmq93OGJT3'; // <-- Add your Cohere Trial API key here
        this.apiUrl = 'https://api.cohere.ai/v1/chat';
        this.conversationHistory = [];
    }

    async generateResponse(userMessage) {
        if (!this.apiKey) {
            throw new Error('Please configure your Cohere API key.');
        }

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'command-a-03-2025', // Optimized model available on the free trial tier
                message: userMessage,
                chat_history: this.conversationHistory
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.text?.trim();

        if (!aiResponse) throw new Error('No response generated');

        // Append the current turn to history for subsequent tracking
        this.conversationHistory.push({ role: 'USER', message: userMessage });
        this.conversationHistory.push({ role: 'CHATBOT', message: aiResponse });

        // Keep the last 20 messages (10 complete turns) to control payload size
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }

        return aiResponse;
    }
}