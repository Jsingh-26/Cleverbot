import { chatState } from './chatState.js';
import { ui } from './ui.js';
import { api } from './api.js';

class ChatApp {
    constructor() {
        this.setupEventListeners();
        this.setupStateObservers();
    }

    setupEventListeners() {
        // Send button click
        ui.sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSendMessage();
        });

        // Enter key press
        ui.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        // Input validation
        ui.chatInput.addEventListener('input', () => {
            ui.updateSendButtonState();
        });
    }

    setupStateObservers() {
        chatState.addObserver((state) => {
            ui.setInputState(!state.isProcessing);
        });
    }

    async handleSendMessage() {
        const message = ui.getInputValue();
        if (!message || chatState.isProcessing) return;

        // Update state and UI
        chatState.setProcessing(true);
        chatState.setLastUserMessage(message);
        ui.clearInput();

        // Display user message
        ui.appendMessage(message, 'user');
        
        // Show thinking indicator
        const thinking = ui.appendThinkingIndicator();

        try {
            const response = await this.sendMessageWithFallback(message);
            
            // Remove thinking indicator
            thinking.remove();

            if (response.success) {
                ui.appendMessage(response.message, 'bot', response.modelId);
            } else {
                throw response.error;
            }
        } catch (error) {
            console.error('Error:', error);
            thinking.remove();
            ui.appendMessage(`Error: ${error.message}`, 'bot');
        } finally {
            chatState.setProcessing(false);
            ui.focusInput();
        }
    }

    async sendMessageWithFallback(message) {
        let response;
        let currentModel = chatState.getCurrentModel();

        do {
            response = await api.sendMessage(message, currentModel);
            
            if (!response.success && chatState.hasNextModel()) {
                chatState.moveToNextModel();
                currentModel = chatState.getCurrentModel();
            } else {
                break;
            }
        } while (true);

        return response;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
    ui.focusInput();
}); 