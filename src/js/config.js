// Client-side configuration.
//
// There is deliberately NO API key here. The browser only talks to the
// same-origin serverless functions below, which hold the OpenRouter key on
// the server (netlify/functions/chat.mjs).

export const CHAT_ENDPOINT = '/api/chat';
export const MODELS_ENDPOINT = '/api/models';

// Supported models in preference order (best first). This curated order is
// our definition of "best"; at page load it gets filtered against live
// OpenRouter availability (see netlify/functions/models.mjs), so the actual
// #1 changes with whatever is healthy right now.
//
// Keep ids in sync with the functions in netlify/functions/.
export const SUPPORTED_MODELS = [
    { id: 'google/gemini-2.0-pro-exp-02-05:free', name: 'Gemini Pro Exp', provider: 'Google' },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'Google' },
    { id: 'google/gemini-exp-1206:free', name: 'Gemini Exp 1206', provider: 'Google' },
    { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', provider: 'Meta' },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B', provider: 'MistralAI' },
    { id: 'qwen/qwen-2-7b-instruct:free', name: 'Qwen 2 7B', provider: 'Qwen' },
    { id: 'huggingfaceh4/zephyr-7b-beta:free', name: 'Zephyr 7B', provider: 'HuggingFace' },
    { id: 'openchat/openchat-7b:free', name: 'OpenChat 7B', provider: 'OpenChat' }
];

// The model chain actually used by the app (full list by default; reordered
// at startup by setActiveModels once live availability is known).
let activeModelIds = SUPPORTED_MODELS.map((m) => m.id);

export const setActiveModels = (ids) => {
    const known = new Set(SUPPORTED_MODELS.map((m) => m.id));
    const valid = (Array.isArray(ids) ? ids : []).filter((id) => known.has(id));
    if (valid.length > 0) activeModelIds = [...valid];
};

export const getModels = () => [...activeModelIds];

export const getModelInfo = (modelId) =>
    SUPPORTED_MODELS.find((m) => m.id === modelId) || (() => {
        const [provider = 'Unknown', name = modelId] = (modelId || '').split('/');
        return { id: modelId, name, provider };
    })();

export const formatModelName = (modelId) => {
    const info = getModelInfo(modelId);
    return `${info.provider} - ${info.name}`;
};
