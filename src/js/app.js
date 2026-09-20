import { getModels } from './config.js';
import { makeApiRequest, processStream } from './api.js';
import { ui } from './ui.js';

// How many past messages to send as conversation context
const MAX_HISTORY_MESSAGES = 24;

let isProcessing = false;

// In-memory chat history: [{ message, type: 'user'|'bot', modelId, timestamp }]
const messageHistory = [];

const saveMessage = (message, type, modelId = null) => {
    messageHistory.push({ message, type, modelId, timestamp: Date.now() });
};

// Convert saved history into OpenRouter message format (capped).
const buildConversation = () =>
    messageHistory
        .filter((entry) => entry.type === 'user' || entry.type === 'bot')
        .slice(-MAX_HISTORY_MESSAGES)
        .map((entry) => ({
            role: entry.type === 'user' ? 'user' : 'assistant',
            content: entry.message
        }));

// Send the current input message, falling back through the (dynamically
// ordered) model chain.
async function sendMessage() {
    const userMessage = ui.getInputValue();
    if (!userMessage || isProcessing) return;

    isProcessing = true;
    ui.setInputState(false);

    let thinkingIndicator = null;
    let botWrapper = null;

    try {
        ui.appendMessage(userMessage, 'user');
        saveMessage(userMessage, 'user');
        ui.clearInput();

        thinkingIndicator = ui.appendThinkingIndicator();
        const messages = buildConversation();
        const models = getModels(); // snapshot: best-first as of page load

        for (let i = 0; i < models.length; i++) {
            const { success, response, error } = await makeApiRequest(messages, i);

            if (!success) {
                console.warn(`Model ${models[i]} failed:`, error);
                continue; // fall back to the next model
            }

            if (thinkingIndicator) {
                thinkingIndicator.remove();
                thinkingIndicator = null;
            }

            botWrapper = ui.appendMessage('', 'bot', models[i]);
            const botMessageEl = botWrapper.querySelector('.message');
            let rawResponse = '';

            try {
                const { received } = await processStream(response, (content) => {
                    rawResponse += content;
                    ui.renderMessageContent(botMessageEl, rawResponse, { streaming: true });
                });

                if (!received || !rawResponse.trim()) {
                    throw new Error('Model returned an empty response');
                }

                // Final render: markdown + sanitization + syntax highlighting
                ui.renderMessageContent(botMessageEl, rawResponse, { streaming: false });
                saveMessage(rawResponse, 'bot', models[i]);
                return; // done
            } catch (streamError) {
                console.warn(`Stream from ${models[i]} failed:`, streamError.message);
                botWrapper?.remove();
                botWrapper = null;
                // fall through and try the next model
            }
        }

        // Every model failed or returned nothing
        ui.appendMessage(
            'Error: Unable to get a response from any available model. Please try again later.',
            'error'
        );
    } catch (error) {
        console.error('Unexpected error in sendMessage:', error);
        botWrapper?.remove();
        ui.appendMessage('An unexpected error occurred. Please try again.', 'error');
    } finally {
        isProcessing = false;
        ui.setInputState(true);
        ui.focusInput();
        thinkingIndicator?.remove();
    }
}

// Event listeners (module scripts are deferred; DOMContentLoaded fires after
// this code runs, so registering here is safe).
document.addEventListener('DOMContentLoaded', () => {
    ui.chatInput.addEventListener('input', () => ui.updateSendButtonState());

    ui.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    ui.sendButton.addEventListener('click', () => sendMessage());
});

export { sendMessage, messageHistory };
