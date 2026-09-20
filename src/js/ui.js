// UI management module.
//
// Bot messages are rendered as markdown (marked) and sanitized with DOMPurify
// before touching innerHTML — model output is untrusted data. User and error
// messages always use textContent.

const { marked, hljs, DOMPurify } = window;

if (marked) {
    // marked v15 removed the legacy options (sanitize, headerIds, mangle,
    // highlight). Code highlighting is applied manually after rendering.
    marked.setOptions({
        breaks: true,   // Convert single newlines to <br>
        gfm: true       // GitHub Flavored Markdown
    });
}

// Markdown -> sanitized HTML. Returns null when the markdown toolchain is
// unavailable (CDN offline), so callers can fall back to plain text.
const safeMarkdown = (raw) => {
    if (!marked || !DOMPurify) return null;
    return DOMPurify.sanitize(marked.parse(raw), { USE_PROFILES: { html: true } });
};

export class UI {
    constructor() {
        this.chatDisplay = document.querySelector('#chat-display');
        this.messageContainer = document.querySelector('.message-container');
        this.chatInput = document.querySelector('#chat-input');
        this.sendButton = document.querySelector('#send');
        this.modelInfoTemplate = document.querySelector('#model-info-template');
        this.thinkingTemplate = document.querySelector('#thinking-template');

        // Streaming render throttling state
        this._pendingRender = new WeakMap();
        this._scheduledFrames = new Set();

        this.updateSendButtonState();
    }

    // Render markdown into a message element. During streaming, re-renders are
    // throttled to one per animation frame and syntax highlighting is skipped;
    // the final render (streaming: false) also applies highlighting.
    renderMessageContent(messageEl, raw, { streaming = false } = {}) {
        if (!messageEl) return;

        if (!streaming) {
            this._pendingRender.delete(messageEl); // cancel any queued stream frame
            const html = safeMarkdown(raw);
            if (html === null) {
                messageEl.textContent = raw;
            } else {
                messageEl.innerHTML = html;
                messageEl.querySelectorAll('pre code').forEach((block) => hljs?.highlightElement(block));
            }
            this.scrollToBottom();
            return;
        }

        this._pendingRender.set(messageEl, raw);
        if (this._scheduledFrames.has(messageEl)) return;

        this._scheduledFrames.add(messageEl);
        requestAnimationFrame(() => {
            this._scheduledFrames.delete(messageEl);
            const latest = this._pendingRender.get(messageEl);
            if (latest === undefined) return; // final render already ran
            const html = safeMarkdown(latest);
            if (html === null) {
                messageEl.textContent = latest;
            } else {
                messageEl.innerHTML = html;
            }
            this.scrollToBottom();
        });
    }

    createMessageWrapper(type) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${type}`;

        const content = document.createElement('div');
        content.className = 'message-content';

        const avatar = document.createElement('div');
        avatar.className = `avatar ${type}-avatar`;
        avatar.textContent = type === 'user' ? 'U' : (type === 'error' ? '!' : 'C');

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
        modelInfo.querySelector('.model-name').textContent = this.formatModelName(modelId);
        return modelInfo;
    }

    createThinkingIndicator() {
        const template = this.thinkingTemplate.content.cloneNode(true);
        return template.querySelector('.thinking');
    }

    appendMessage(content, type, modelId = null) {
        const { wrapper, message } = this.createMessageWrapper(type);

        if (type === 'bot') {
            this.renderMessageContent(message, content, { streaming: false });
        } else {
            // User and error messages are plain text — never HTML.
            message.textContent = content;
        }

        if (type === 'bot' && modelId) {
            wrapper.appendChild(this.createModelInfo(modelId));
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
        if (!this.chatInput.disabled) {
            this.sendButton.disabled = !this.getInputValue();
        }
    }

    scrollToBottom() {
        this.chatDisplay.scrollTop = this.chatDisplay.scrollHeight;
    }

    formatModelName(modelId) {
        const [provider, model] = modelId.split('/');
        const formattedModel = (model || '').split('-').map((word) =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        const formattedProvider = provider
            ? provider.charAt(0).toUpperCase() + provider.slice(1)
            : 'Unknown';
        return `${formattedProvider} - ${formattedModel}`;
    }
}

// Singleton instance
export const ui = new UI();
