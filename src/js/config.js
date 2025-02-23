// API Configuration
export const API_URL = window.ENV?.API_URL || 'https://openrouter.ai/api/v1/chat/completions';

// Load API key from environment variable
const getApiKey = () => {
    if (!window.ENV) {
        console.error('Environment variables not loaded. Please check env.js');
        return null;
    }

    const apiKey = window.ENV.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('API key not found in environment variables');
        return null;
    }

    if (!apiKey.startsWith('sk-or-')) {
        console.error('Invalid API key format. Must start with sk-or-');
        return null;
    }

    console.log('API key loaded successfully');
    return apiKey;
};

const apiKey = getApiKey();
if (!apiKey) {
    console.error('No valid API key available. Application will not function correctly.');
} else {
    // Only log the first and last 4 characters for security
    const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
    console.log('API key (masked):', maskedKey);
}

export const API_KEY = apiKey;

// Model Configuration
export const MODELS = [
    'google/gemini-2.0-pro-exp-02-05:free',  // Best overall free model
    'mistralai/mistral-7b-instruct:free'     // Reliable backup model
];

// Model metadata for UI display and features
export const MODEL_INFO = {
    'google/gemini-2.0-pro-exp-02-05:free': {
        name: 'Gemini Pro',
        provider: 'Google',
        description: 'Latest Gemini model with excellent performance',
        contextLength: 128000,
        isCodeCapable: true
    },
    'mistralai/mistral-7b-instruct:free': {
        name: 'Mistral 7B',
        provider: 'MistralAI',
        description: 'Reliable open-source model',
        contextLength: 8192,
        isCodeCapable: true
    }
};

// Helper functions for model management
export const getModelInfo = (modelId) => MODEL_INFO[modelId] || {
    name: modelId.split('/')[1],
    provider: modelId.split('/')[0],
    description: 'Model information not available',
    contextLength: 4096,
    isCodeCapable: false
};

export const formatModelName = (modelId) => {
    const info = getModelInfo(modelId);
    return `${info.provider} - ${info.name}`;
};

// Log available models and configuration
console.log('Configuration loaded:', {
    apiUrl: API_URL,
    hasApiKey: !!API_KEY,
    models: MODELS.map(id => ({
        id,
        ...getModelInfo(id)
    })),
    environment: window.ENV ? 'production' : 'development'
}); 