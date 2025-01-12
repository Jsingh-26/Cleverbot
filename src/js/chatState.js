// Chat state management module
export class ChatState {
    constructor() {
        this.isProcessing = false;
        this.lastUserMessage = '';
        this.currentModelIndex = 0;
        this.observers = new Set();
        
        this.MODELS = [
            'google/gemini-pro',
            'meta-llama/llama-2-70b-chat',
            'anthropic/claude-3-opus',
            'anthropic/claude-3-sonnet',
            'anthropic/claude-3-haiku',
            'meta-llama/llama-2-13b-chat',
            'gryphe/mythomist-7b',
            'nousresearch/nous-capybara-7b',
            'openchat/openchat-7b',
            'mistralai/mistral-7b-instruct',
            'rwkv/rwkv-5-world-3b',
            'google/gemini-1.5-pro',
            'anthropic/claude-2.1',
            'anthropic/claude-2.0',
            'anthropic/claude-instant-1.2',
            'meta-llama/codellama-34b-instruct',
            'meta-llama/llama-2-13b-chat',
            'google/palm-2-chat-bison',
            'google/palm-2-codechat-bison',
            'meta-llama/llama-2-7b-chat',
            'phind/phind-codellama-34b',
            'nousresearch/nous-hermes-2-mixtral-8x7b-dpo',
            'deepseek-ai/deepseek-coder-33b-instruct',
            'perplexity/pplx-70b-chat',
            'perplexity/pplx-7b-chat',
            'jondurbin/airoboros-l2-70b'
        ];
    }

    // State management methods
    setProcessing(isProcessing) {
        this.isProcessing = isProcessing;
        this.notifyObservers();
    }

    setLastUserMessage(message) {
        this.lastUserMessage = message;
        this.notifyObservers();
    }

    setCurrentModelIndex(index) {
        this.currentModelIndex = index;
        this.notifyObservers();
    }

    getCurrentModel() {
        return this.MODELS[this.currentModelIndex];
    }

    // Observer pattern methods
    addObserver(observer) {
        this.observers.add(observer);
    }

    removeObserver(observer) {
        this.observers.delete(observer);
    }

    notifyObservers() {
        this.observers.forEach(observer => observer(this));
    }

    // Model management methods
    hasNextModel() {
        return this.currentModelIndex < this.MODELS.length - 1;
    }

    moveToNextModel() {
        if (this.hasNextModel()) {
            this.setCurrentModelIndex(this.currentModelIndex + 1);
            return true;
        }
        return false;
    }

    resetModelIndex() {
        this.setCurrentModelIndex(0);
    }

    formatModelName(modelId) {
        const [provider, model] = modelId.split('/');
        return `${provider.charAt(0).toUpperCase() + provider.slice(1)} - ${model}`;
    }
}

// Export a singleton instance
export const chatState = new ChatState(); 