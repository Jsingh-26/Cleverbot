const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = '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';

// Define models for different modes
const MODELS = {
    writing: [
        { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 [writing, analysis, coding]' },
        { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat [writing, analysis, coding]', maxFreeUsage: 25 },
        { value: 'mistralai/mistral-7b-instruct', label: 'Mistral 7B [writing, analysis]', maxFreeUsage: 50 },
        { value: 'meta-llama/llama-2-13b-chat', label: 'Llama 2 13B [writing, creative]', maxFreeUsage: 50 },
        { value: 'openchat/openchat-7b', label: 'OpenChat 7B [writing, chat]', maxFreeUsage: 50 }
    ],
    coding: [
        { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 [coding, analysis, writing]' },
        { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat [coding, analysis, writing]', maxFreeUsage: 25 },
        { value: 'nousresearch/nous-hermes-llama2-13b', label: 'Nous Hermes 13B [coding, reasoning]', maxFreeUsage: 50 }
    ]
};

let currentMode = 'writing';

// Initialize usage counters in localStorage if not exists
function initializeUsageCounters() {
    const usage = localStorage.getItem('modelUsage');
    if (!usage) {
        const initialUsage = {};
        Object.values(MODELS).flat().forEach(model => {
            initialUsage[model.value] = 0;
        });
        localStorage.setItem('modelUsage', JSON.stringify(initialUsage));
    }
}

// Get remaining uses for a model
function getRemainingUses(modelId) {
    const usage = JSON.parse(localStorage.getItem('modelUsage') || '{}');
    const model = Object.values(MODELS).flat().find(m => m.value === modelId);
    const used = usage[modelId] || 0;
    return model.maxFreeUsage - used;
}

// Increment usage counter for a model
function incrementUsage(modelId) {
    const usage = JSON.parse(localStorage.getItem('modelUsage') || '{}');
    usage[modelId] = (usage[modelId] || 0) + 1;
    localStorage.setItem('modelUsage', JSON.stringify(usage));
    updateModelDescription(); // Update the display
}

function switchMode(mode) {
    currentMode = mode;
    
    // Update buttons
    document.querySelectorAll('.mode-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update coding options visibility
    const codingOptions = document.getElementById('coding-options');
    codingOptions.classList.toggle('visible', mode === 'coding');

    // Clear input and result
    const textarea = document.getElementById('topic');
    const resultDiv = document.getElementById('result');
    textarea.value = '';
    resultDiv.innerHTML = '';

    // Update placeholder text
    textarea.placeholder = mode === 'writing' 
        ? 'Enter your essay topic here...'
        : 'Describe what you want to code (e.g., "Create a function to calculate fibonacci numbers")...';

    // Update models dropdown
    populateModels(mode);
}

function populateModels(mode) {
    const select = document.getElementById('model');
    select.innerHTML = MODELS[mode]
        .map(model => `<option value="${model.value}">${model.label}</option>`)
        .join('');
    updateModelDescription();
}

function updateModelDescription() {
    const select = document.getElementById('model');
    const descriptionDiv = document.getElementById('modelDescription');
    const selectedOption = select.options[select.selectedIndex];
    const modelId = selectedOption.value;
    const capabilities = selectedOption.text.match(/\[(.*?)\]/)[1];
    const remaining = getRemainingUses(modelId);
    
    descriptionDiv.innerHTML = `
        <div>Capabilities: ${capabilities}</div>
        <div style="color: ${remaining < 5 ? '#dc2626' : '#666'}; margin-top: 4px;">
            Estimated free uses remaining: ${remaining}
        </div>
    `;
}

function formatCode(content, language) {
    // First, try to extract code blocks with markdown syntax
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let formattedContent = content;
    let hasCodeBlock = false;

    formattedContent = formattedContent.replace(codeBlockRegex, (_, lang, code) => {
        hasCodeBlock = true;
        const highlightLang = lang || language;
        return `<div class="code-block">
            <div class="code-header">${highlightLang}</div>
            <pre><code class="language-${highlightLang}">${code.trim()}</code></pre>
        </div>`;
    });

    // If no code blocks found, wrap the entire content as a code block
    if (!hasCodeBlock && currentMode === 'coding') {
        formattedContent = `<div class="code-block">
            <div class="code-header">${language}</div>
            <pre><code class="language-${language}">${content.trim()}</code></pre>
        </div>`;
    }

    return formattedContent;
}

async function generateContent() {
    const topicInput = document.getElementById('topic');
    const modelSelect = document.getElementById('model');
    const generateButton = document.getElementById('generate');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');

    const topic = topicInput.value.trim();
    const selectedModel = modelSelect.value;

    if (!topic) {
        alert('Please enter your request.');
        return;
    }

    generateButton.disabled = true;
    loadingDiv.style.display = 'block';
    resultDiv.textContent = '';

    let prompt;
    const language = document.getElementById('language').value;
    
    if (currentMode === 'writing') {
        prompt = `Write a well-structured, informative 500-word essay about the following topic: ${topic}. 
        The essay should include an introduction, body paragraphs, and a conclusion. 
        Make it engaging and informative while maintaining academic standards.`;
    } else {
        prompt = `Write a complete, working code solution in ${language} for the following request: ${topic}
        Please provide:
        1. A clean, efficient implementation
        2. Brief comments explaining the code
        3. Example usage if applicable
        Make sure the code follows best practices and is production-ready.
        Use markdown code blocks with language specification for the code.`;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'AI Assistant'
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1500
            })
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.error) {
                // Handle quota errors
                if (data.error.type === 'insufficient_quota') {
                    const errorMessage = `Usage limit reached for ${selectedModel.split('/')[1]}. 
                    This is a paid model and the free credits have been exhausted. 
                    Please try using a different model or try again later.`;
                    throw new Error(errorMessage);
                }
                // Handle rate limit errors
                else if (data.error.message?.toLowerCase().includes('rate limit')) {
                    const errorMessage = `Rate limit reached. You're making requests too quickly. 
                    Please wait a few minutes before trying again.`;
                    throw new Error(errorMessage);
                }
                // Handle other quota-related errors
                else if (data.error.message?.toLowerCase().includes('quota')) {
                    const errorMessage = `API quota exceeded. 
                    ${data.error.message}
                    Please try using a different model or try again later.`;
                    throw new Error(errorMessage);
                }
                // Handle other API errors
                else {
                    throw new Error(data.error.message || 'API request failed');
                }
            }
            throw new Error('API request failed');
        }

        // Increment usage counter on successful request
        incrementUsage(selectedModel);

        const content = data.choices[0].message.content;
        
        if (currentMode === 'coding') {
            resultDiv.innerHTML = formatCode(content, language);
            // Trigger Prism to highlight the code
            Prism.highlightAll();
        } else {
            resultDiv.textContent = content;
        }

    } catch (error) {
        console.error('Error:', error);
        resultDiv.innerHTML = `<div class="error">
            <strong>Error:</strong><br>
            ${error.message || 'Sorry, there was an error processing your request. Please try again.'}
            ${error.message?.includes('limit') || error.message?.includes('quota') ? 
                '<br><br><small>Tip: Try switching to a different model from the dropdown above.</small>' : ''}
        </div>`;
    } finally {
        generateButton.disabled = false;
        loadingDiv.style.display = 'none';
    }
}

// Initialize the interface
document.addEventListener('DOMContentLoaded', () => {
    initializeUsageCounters();
    switchMode('writing');
}); 