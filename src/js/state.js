// State management class
class ChatState {
    constructor() {
        this.isProcessing = false;
        this.lastUserMessage = '';
        this.currentModelIndex = 0;
        this.messageHistory = [];
        this.observers = new Set();
        this.errors = [];
    }

    addMessage(message, type, modelId = null) {
        const messageObj = {
            id: Date.now(),
            message,
            type,
            modelId,
            timestamp: new Date().toISOString()
        };
        this.messageHistory.push(messageObj);
        this.notifyObservers('message', messageObj);
    }

    setProcessing(isProcessing) {
        this.isProcessing = isProcessing;
        this.notifyObservers('processing', isProcessing);
    }

    setCurrentModel(modelIndex) {
        this.currentModelIndex = modelIndex;
        this.notifyObservers('model', modelIndex);
    }

    addError(error) {
        const errorObj = {
            id: Date.now(),
            message: error.message,
            type: this.categorizeError(error),
            timestamp: new Date().toISOString(),
            modelId: this.getCurrentModel()
        };
        this.errors.push(errorObj);
        this.notifyObservers('error', errorObj);
    }

    categorizeError(error) {
        if (error.message.includes('rate limit')) return 'RATE_LIMIT';
        if (error.message.includes('quota')) return 'QUOTA_EXCEEDED';
        if (error.message.includes('timeout')) return 'TIMEOUT';
        return 'UNKNOWN';
    }

    getCurrentModel() {
        return MODELS[this.currentModelIndex];
    }

    addObserver(callback) {
        this.observers.add(callback);
        return () => this.observers.delete(callback);
    }

    notifyObservers(type, data) {
        this.observers.forEach(observer => observer(type, data));
    }

    // For debugging and monitoring
    getState() {
        return {
            isProcessing: this.isProcessing,
            lastUserMessage: this.lastUserMessage,
            currentModelIndex: this.currentModelIndex,
            currentModel: this.getCurrentModel(),
            messageCount: this.messageHistory.length,
            errorCount: this.errors.length
        };
    }
}

// Create singleton instance
const chatState = new ChatState();
export default chatState; 