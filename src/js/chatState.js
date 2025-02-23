import { MODELS, formatModelName } from './config.js';

// Chat state management module
export class ChatState {
    constructor() {
        this.isProcessing = false;
        this.lastUserMessage = '';
        this.currentModelIndex = 0;
        this.observers = new Set();
    }

    // Model management methods
    getCurrentModel() {
        return MODELS[this.currentModelIndex];
    }

    hasNextModel() {
        return this.currentModelIndex < MODELS.length - 1;
    }

    moveToNextModel() {
        if (this.hasNextModel()) {
            this.setCurrentModelIndex(this.currentModelIndex + 1);
            return true;
        }
        return false;
    }

    setCurrentModelIndex(index) {
        if (index >= 0 && index < MODELS.length) {
            this.currentModelIndex = index;
            this.notifyObservers();
            return true;
        }
        return false;
    }

    // Observer pattern implementation
    addObserver(observer) {
        this.observers.add(observer);
    }

    removeObserver(observer) {
        this.observers.delete(observer);
    }

    notifyObservers() {
        this.observers.forEach(observer => observer(this.getState()));
    }

    // State management
    getState() {
        return {
            isProcessing: this.isProcessing,
            lastUserMessage: this.lastUserMessage,
            currentModelIndex: this.currentModelIndex,
            currentModel: this.getCurrentModel(),
            hasNextModel: this.hasNextModel(),
            modelName: formatModelName(this.getCurrentModel())
        };
    }
}

// Export a singleton instance
export const chatState = new ChatState(); 