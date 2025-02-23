// API Configuration
export const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Load API key from environment variable
const getApiKey = () => {
    // For production environment
    if (window.ENV && window.ENV.OPENROUTER_API_KEY) {
        return window.ENV.OPENROUTER_API_KEY;
    }
    
    // For local development
    const localKey = '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';
    
    if (!window.ENV) {
        console.warn('ENV object not found. Make sure env.js is loaded correctly.');
    } else if (!window.ENV.OPENROUTER_API_KEY) {
        console.warn('OPENROUTER_API_KEY not found in ENV. Using local development key.');
    }
    
    return localKey;
};

const apiKey = getApiKey();
if (!apiKey) {
    console.error('No API key available. Application will not function correctly.');
}

export const API_KEY = apiKey;

// Model Configuration - Only the best 4 models
export const MODELS = [
    'google/gemini-pro-1.5-exp',      // Latest Gemini model, very capable
    'meta-llama/llama-3.1-70b-instruct-free',  // Large Llama model, excellent performance
    'mistral/mistral-7b-instruct-free',  // Efficient and reliable
    'google/gemma-2-9b-it-free'  // New Google model, good balance of size and capability
]; 