// UI management module
export class UI {
    constructor() {
        this.chatDisplay = document.querySelector('#chat-display');
        this.messageContainer = document.querySelector('.message-container');
        this.chatInput = document.querySelector('#chat-input');
        this.sendButton = document.querySelector('#send');
        this.modelInfoTemplate = document.querySelector('#model-info-template');
        this.thinkingTemplate = document.querySelector('#thinking-template');

        // Initialize send button state
        this.updateSendButtonState();
    }

    // Message creation methods
    createMessageWrapper(type) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${type}`;
        wrapper.setAttribute('role', 'listitem');

        const content = document.createElement('div');
        content.className = 'message-content';

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = type === 'user' ? 'U' : 'B';

        const message = document.createElement('div');
        message.className = 'message';

        content.appendChild(avatar);
        content.appendChild(message);
        wrapper.appendChild(content);

        return { wrapper, message };
    }

    createModelInfo(modelId) {
        const template = this.modelInfoTemplate.content.cloneNode(true);
        const modelInfo = template.querySelector('.model-info');
        const modelName = modelInfo.querySelector('.model-name');
        modelName.textContent = this.formatModelName(modelId);
        return modelInfo;
    }

    createThinkingIndicator() {
        const template = this.thinkingTemplate.content.cloneNode(true);
        return template.querySelector('.thinking');
    }

    // Message display methods
    appendMessage(content, type, modelId = null) {
        const { wrapper, message } = this.createMessageWrapper(type);
        message.textContent = content;

        if (type === 'bot' && modelId) {
            const modelInfo = this.createModelInfo(modelId);
            wrapper.appendChild(modelInfo);
        }

        this.messageContainer.appendChild(wrapper);
        this.scrollToBottom();
        return wrapper;
    }

    appendThinkingIndicator() {
        const thinking = this.createThinkingIndicator();
        this.messageContainer.appendChild(thinking);
        this.scrollToBottom();
        return thinking;
    }

    removeThinkingIndicator() {
        const thinking = this.messageContainer.querySelector('.thinking');
        if (thinking) {
            thinking.remove();
        }
    }

    // Input handling methods
    getInputValue() {
        return this.chatInput.value.trim();
    }

    clearInput() {
        this.chatInput.value = '';
        this.updateSendButtonState();
    }

    focusInput() {
        this.chatInput.focus();
    }

    setInputState(enabled) {
        this.chatInput.disabled = !enabled;
        this.sendButton.disabled = !enabled || !this.getInputValue();
    }

    updateSendButtonState() {
        this.sendButton.disabled = !this.getInputValue();
    }

    // Utility methods
    scrollToBottom() {
        this.chatDisplay.scrollTop = this.chatDisplay.scrollHeight;
    }

    formatModelName(modelId) {
        const [provider, model] = modelId.split('/');
        return `${provider.charAt(0).toUpperCase() + provider.slice(1)} - ${model}`;
    }
}

// Export a singleton instance
export const ui = new UI(); 