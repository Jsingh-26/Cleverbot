// API Configuration
export const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Load API key from environment variable
const getApiKey = () => {
    // For production environment
    if (window.ENV && window.ENV.OPENROUTER_API_KEY) {
        console.log('Using API key from environment variables');
        return window.ENV.OPENROUTER_API_KEY;
    }
    
    // For local development
    const localKey = 'REDACTED_OPENROUTER_KEY';
    
    if (!window.ENV) {
        console.warn('ENV object not found. Make sure env.js is loaded correctly.');
        console.log('window.ENV:', window.ENV);
    } else if (!window.ENV.OPENROUTER_API_KEY) {
        console.warn('OPENROUTER_API_KEY not found in ENV. Using local development key.');
        console.log('Available ENV variables:', Object.keys(window.ENV));
    }
    
    console.log('Using local development API key');
    return localKey;
};

const apiKey = getApiKey();
if (!apiKey) {
    console.error('No API key available. Application will not function correctly.');
} else {
    console.log('API key configured successfully');
    // Only log the first and last 4 characters for security
    const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
    console.log('API key (masked):', maskedKey);
}

export const API_KEY = apiKey;

// Model Configuration - Models with '-free' suffix
export const MODELS = [
    'meta-llama/llama-2-70b-chat-free',     // Most capable free Llama model
    'mistral/mistral-7b-instruct-free',     // Efficient and reliable
    'phind/phind-codellama-34b-free',       // Great for code and general tasks
    'nousresearch/nous-hermes-2-vision-free' // Vision capable model
];

// Log available models
console.log('Configured models:', MODELS); 