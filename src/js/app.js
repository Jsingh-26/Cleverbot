import { MODELS } from './config.js';
import { makeApiRequest, processStream } from './api.js';
import { ui } from './ui.js';

// State management
let isProcessing = false;
let lastUserMessage = '';
let currentModelIndex = 0;

// Message history management
const messageHistory = [];
const saveMessage = (message, type) => {
    messageHistory.push({ 
        message, 
        type, 
        timestamp: Date.now() 
    });
};

// Main message handling function
async function sendMessage(message = null, startFromModel = 0) {
    if (isProcessing) return;
    
    const userMessage = message || ui.getInputValue();
    
    if (!userMessage) return;
    
    isProcessing = true;
    lastUserMessage = userMessage;
    currentModelIndex = startFromModel;
    
    let thinkingIndicator = null;
    
    try {
        ui.setInputState(false);
        
        if (!message) {
            ui.appendMessage(userMessage, 'user');
            saveMessage(userMessage, 'user');
            ui.clearInput();
        }
        
        thinkingIndicator = ui.appendThinkingIndicator();
        let responseReceived = false;
        
        for (let i = startFromModel; i < MODELS.length; i++) {
            currentModelIndex = i;
            console.log(`Trying model: ${MODELS[i]}`);
            
            const { success, response, error } = await makeApiRequest(userMessage, i);
            
            if (!success) {
                console.error(`Error with model ${MODELS[i]}:`, error);
                if (i === MODELS.length - 1) {
                    if (thinkingIndicator) {
                        thinkingIndicator.remove();
                        thinkingIndicator = null;
                    }
                    ui.appendMessage('Error: Unable to get response from any available model. Please try again later.', 'error');
                }
                continue;
            }
            
            try {
                if (thinkingIndicator) {
                    thinkingIndicator.remove();
                    thinkingIndicator = null;
                }
                
                const botMessageElement = ui.appendMessage('', 'bot', MODELS[i]);
                responseReceived = false;
                
                await processStream(response, (content) => {
                    responseReceived = true;
                    if (botMessageElement.querySelector('.message')) {
                        botMessageElement.querySelector('.message').textContent += content;
                    }
                    ui.scrollToBottom();
                });
                
                if (!responseReceived) {
                    throw new Error('No content received from stream');
                }
                
                saveMessage(botMessageElement.querySelector('.message').textContent, 'bot');
                break;
            } catch (streamError) {
                console.error('Error processing stream:', streamError);
                if (i === MODELS.length - 1) {
                    ui.appendMessage('Error: Failed to process the response. Please try again.', 'error');
                }
                continue;
            }
        }
    } catch (error) {
        console.error('Error:', error);
        if (thinkingIndicator) {
            thinkingIndicator.remove();
        }
        ui.appendMessage('An unexpected error occurred. Please try again.', 'error');
    } finally {
        isProcessing = false;
        ui.setInputState(true);
        if (thinkingIndicator) {
            thinkingIndicator.remove();
        }
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Input event for enabling/disabling send button
    ui.chatInput.addEventListener('input', () => {
        ui.updateSendButtonState();
    });
    
    // Enter key press
    ui.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Send button click
    ui.sendButton.addEventListener('click', () => sendMessage());
});

// Export functions for external use
export { sendMessage, messageHistory }; 