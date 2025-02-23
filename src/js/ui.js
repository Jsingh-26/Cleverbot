// Use the global marked instance
const { marked } = window;
import 'https://cdn.jsdelivr.net/npm/highlight.js@11.8.0/lib/languages/javascript.min.js';

// Configure marked options
marked.setOptions({
    breaks: true,        // Convert \n to <br>
    gfm: true,          // Enable GitHub Flavored Markdown
    headerIds: true,    // Add IDs to headers
    mangle: false,      // Don't escape HTML
    sanitize: false,    // Allow HTML
    smartLists: true,   // Use smarter list behavior
    smartypants: true,  // Use smart punctuation
    xhtml: true,        // Use XHTML style tags
    highlight: function(code, lang) {
        return hljs.highlightAuto(code).value;
    }
});

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

        // Add markdown styles
        this.addMarkdownStyles();
    }

    // Add styles for markdown content
    addMarkdownStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .message-content .message {
                line-height: 1.6;
                font-size: 1rem;
                white-space: pre-wrap;
            }
            .message-content .message > *:first-child {
                margin-top: 0;
            }
            .message-content .message > *:last-child {
                margin-bottom: 0;
            }
            .message-content .message p {
                margin: 1em 0;
            }
            .message-content .message h1,
            .message-content .message h2,
            .message-content .message h3,
            .message-content .message h4 {
                margin: 1.5em 0 0.5em;
                font-weight: 600;
                line-height: 1.3;
            }
            .message-content .message h1 { font-size: 1.5em; }
            .message-content .message h2 { font-size: 1.3em; }
            .message-content .message h3 { font-size: 1.2em; }
            .message-content .message h4 { font-size: 1.1em; }
            
            .message-content .message code {
                background-color: rgba(0, 0, 0, 0.05);
                padding: 0.2em 0.4em;
                border-radius: 3px;
                font-family: 'Fira Code', monospace;
                font-size: 0.9em;
            }
            .message-content .message pre {
                background-color: rgba(0, 0, 0, 0.05);
                padding: 1em;
                border-radius: 5px;
                overflow-x: auto;
                margin: 1em 0;
            }
            .message-content .message pre code {
                background-color: transparent;
                padding: 0;
                display: block;
                line-height: 1.5;
            }
            .message-content .message ul,
            .message-content .message ol {
                margin: 1em 0;
                padding-left: 2em;
            }
            .message-content .message li {
                margin: 0.5em 0;
            }
            .message-content .message blockquote {
                border-left: 4px solid #ddd;
                margin: 1em 0;
                padding: 0.5em 0 0.5em 1em;
                color: #555;
                background-color: rgba(0, 0, 0, 0.02);
            }
            .message-content .message strong {
                font-weight: 600;
            }
            .message-content .message em {
                font-style: italic;
            }
            .message-content .message a {
                color: #0066cc;
                text-decoration: none;
            }
            .message-content .message a:hover {
                text-decoration: underline;
            }
            .message-content .message table {
                border-collapse: collapse;
                margin: 1em 0;
                width: 100%;
            }
            .message-content .message th,
            .message-content .message td {
                border: 1px solid #ddd;
                padding: 0.5em;
                text-align: left;
            }
            .message-content .message th {
                background-color: rgba(0, 0, 0, 0.05);
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    }

    // Message creation methods
    createMessageWrapper(type) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${type}-message`;
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const avatar = document.createElement('div');
        avatar.className = `avatar ${type}-avatar`;
        avatar.textContent = type === 'user' ? 'U' : 'C';
        
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
        
        // Convert markdown to HTML for bot messages
        if (type === 'bot') {
            try {
                const htmlContent = marked.parse(content);
                message.innerHTML = htmlContent;
                
                // Add syntax highlighting to code blocks
                message.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            } catch (error) {
                console.error('Error parsing markdown:', error);
                message.textContent = content;
            }
        } else {
            message.textContent = content;
        }

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
        const formattedModel = model.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        return `${provider.charAt(0).toUpperCase() + provider.slice(1)} - ${formattedModel}`;
    }
}

// Export a singleton instance
export const ui = new UI(); 