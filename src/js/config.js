// API Configuration
export const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Load API key from environment variable
const getApiKey = () => {
    // For Netlify production environment
    if (window.ENV && window.ENV.OPENROUTER_API_KEY) {
        return window.ENV.OPENROUTER_API_KEY;
    }
    
    // For local development
    const localKey = 'REDACTED_OPENROUTER_KEY';
    console.warn('Using local development API key');
    return localKey;
};

export const API_KEY = getApiKey();

// Model Configuration
export const MODELS = [
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