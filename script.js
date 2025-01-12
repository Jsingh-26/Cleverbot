const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = 'REDACTED_OPENROUTER_KEY';

// Define models in order of preference
const MODELS = [
    'google/gemini-exp-1206-free',
    'google/gemini-2.0-flash-exp-free',
    'google/gemini-flash-1.5-8b-exp',
    'google/gemini-flash-1.5-exp',
    'google/gemini-pro-1.5-exp',
    'google/gemini-exp-1121-free',
    'google/learnit-1.5-pro-experimental-free',
    'google/gemini-exp-1114-free',
    'google/gemini-2.0-flash-thinking-exp-free',
    'meta-llama/llama-3.2-13b-vision-instruct-free',
    'meta-llama/llama-3.1-8b-instruct-free',
    'meta-llama/llama-3.1-70b-instruct-free',
    'qwen/qwen-4-7b-instruct-free',
    'google/gemma-2-9b-it-free',
    'mistral/mistral-7b-instruct-free',
    'microsoft/phi-3-mini-128k-instruct-free',
    'microsoft/phi-3-medium-128k-instruct-free',
    'meta-llama/llama-3-8b-instruct-free',
    'openchat/openchat-7b-free',
    'meta-llama/llama-3.1-40b5-instruct-free',
    'meta-llama/llama-3.2-1b-instruct-free',
    'meta-llama/llama-3.2-3b-instruct-free',
    'meta-llama/llama-3.2-90b-vision-instruct-free',
    'undi95/toppy-m-7b-free',
    'huggingface/44/zephy-7b-beta-free',
    'gryphe/mythomix-13b-free'
];

let isProcessing = false;
let lastUserMessage = '';
let currentModelIndex = 0;

// Function to format model name for display
function formatModelName(modelId) {
    const parts = modelId.split('/');
    const provider = parts[0];
    const model = parts[1].split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    return `${provider.charAt(0).toUpperCase() + provider.slice(1)} - ${model}`;
}

// Function to create message wrapper with avatar
function createMessageWrapper(type) {
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

// Function to create model list
function createModelList(modelInfo) {
    const modelList = modelInfo.querySelector('.model-list');
    modelList.innerHTML = '';
    
    MODELS.forEach((modelId, index) => {
        const option = document.createElement('div');
        option.className = 'model-option';
        option.textContent = formatModelName(modelId);
        option.addEventListener('click', () => {
            modelList.classList.remove('show');
            retryWithModel(index);
        });
        modelList.appendChild(option);
    });
}

// Function to create model info section
function createModelInfo(modelId, messageWrapper) {
    const template = document.getElementById('model-info-template');
    const modelInfo = template.content.cloneNode(true);
    modelInfo.querySelector('.model-name').textContent = formatModelName(modelId);
    messageWrapper.appendChild(modelInfo);
}

// Function to create thinking indicator
function createThinkingIndicator() {
    const { wrapper, message } = createMessageWrapper('bot');
    message.innerHTML = `
        <div class="thinking">
            <span>Thinking</span>
            <div class="dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>
    `;
    document.querySelector('.message-container').appendChild(wrapper);
    return wrapper;
}

// Function to safely append messages to chat display
function appendMessage(content, type, modelId = null) {
    const chatDisplay = document.getElementById('chat-display');
    const messageContainer = chatDisplay.querySelector('.message-container');
    
    const { wrapper, message } = createMessageWrapper(type);
    message.textContent = content;
    
    messageContainer.appendChild(wrapper);
    
    if (type === 'bot' && modelId) {
        createModelInfo(modelId, wrapper);
    }
    
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
    return message;
}

// Function to handle errors
function handleError(error, modelIndex) {
    console.error(`Error with model ${MODELS[modelIndex]}:`, error);
    if (modelIndex === MODELS.length - 1) {
        appendMessage('Error: Unable to get response from any available model. Please try again later.', 'error');
    }
    return false;
}

// Function to enable/disable input controls
function setInputState(enabled) {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send');
    
    chatInput.disabled = !enabled;
    sendButton.disabled = !enabled;
    
    if (enabled) {
        chatInput.focus();
        const thinkingIndicator = document.querySelector('.thinking')?.closest('.message-wrapper');
        if (thinkingIndicator) {
            thinkingIndicator.remove();
        }
    }
}

// Function to retry with specific model
async function retryWithModel(modelIndex) {
    if (isProcessing || !lastUserMessage) return;
    
    currentModelIndex = modelIndex;
    if (currentModelIndex >= MODELS.length) {
        currentModelIndex = 0;
    }
    
    await sendMessage(lastUserMessage, currentModelIndex);
}

async function sendMessage(message = null, startFromModel = 0) {
    if (isProcessing) return;
    
    const chatInput = document.getElementById('chat-input');
    const userMessage = message || chatInput.value.trim();
    
    if (!userMessage) return;
    
    isProcessing = true;
    lastUserMessage = userMessage;
    currentModelIndex = startFromModel;
    
    try {
        setInputState(false);
        
        if (!message) {
            appendMessage(userMessage, 'user');
            chatInput.value = '';
        }
        
        // Create thinking indicator only after we have a valid message
        let thinkingIndicator = createThinkingIndicator();
        
        for (let i = startFromModel; i < MODELS.length; i++) {
            currentModelIndex = i;
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_KEY}`,
                        'HTTP-Referer': window.location.origin,
                        'X-Title': 'Cleverbot'
                    },
                    body: JSON.stringify({
                        model: MODELS[i],
                        messages: [
                            { role: 'user', content: userMessage }
                        ],
                        stream: true,
                    }),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error?.message || 'Failed to fetch response');
                }
                
                const reader = response.body.getReader();
                let botMessageElement = null;
                let messageWrapper = null;
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const textDecoder = new TextDecoder();
                    const chunk = textDecoder.decode(value);
                    
                    for (const line of chunk.split('\n')) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                if (data.choices && data.choices[0].delta?.content) {
                                    if (!botMessageElement) {
                                        if (thinkingIndicator) {
                                            thinkingIndicator.remove();
                                            thinkingIndicator = null;
                                        }
                                        const elements = createMessageWrapper('bot');
                                        messageWrapper = elements.wrapper;
                                        botMessageElement = elements.message;
                                        document.querySelector('.message-container').appendChild(messageWrapper);
                                    }
                                    botMessageElement.textContent += data.choices[0].delta.content;
                                    document.getElementById('chat-display').scrollTop = document.getElementById('chat-display').scrollHeight;
                                }
                            } catch (e) {
                                console.error('Error parsing stream:', e);
                            }
                        }
                    }
                }
                
                if (messageWrapper) {
                    createModelInfo(MODELS[i], messageWrapper);
                }
                
                return;
                
            } catch (error) {
                if (!handleError(error, i)) {
                    continue;
                }
            }
        }
    } finally {
        setInputState(true);
        isProcessing = false;
    }
}

// Initialize the interface
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send');
    
    // Remove any existing thinking indicators on load
    const existingThinkingIndicators = document.querySelectorAll('.thinking');
    existingThinkingIndicators.forEach(indicator => {
        const wrapper = indicator.closest('.message-wrapper');
        if (wrapper) wrapper.remove();
    });
    
    sendButton.addEventListener('click', (e) => {
        e.preventDefault();
        sendMessage();
    });
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    chatInput.focus();
}); 