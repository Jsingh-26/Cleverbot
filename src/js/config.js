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
    { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', provider: 'Google' },
    { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B A4B', provider: 'Google' },
    { id: 'qwen/qwen3.8-27b:free', name: 'Qwen 3.8 27B', provider: 'Qwen' },
    { id: 'z-ai/glm-5.2:free', name: 'GLM 5.2', provider: 'Z.AI' },
    { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron 3 Nano Omni Reasoning', provider: 'NVIDIA' },
    { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super 120B', provider: 'NVIDIA' },
    { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 Lightning', provider: 'NVIDIA' },
    { id: 'liquid/lfm-2.5-2.6b:free', name: 'LFM 2.5 2.6B', provider: 'Liquid' },
    { id: 'cohere/north-mini-code:free', name: 'North Mini Code', provider: 'Cohere' },
    { id: 'thinkingmachines/inkling:free', name: 'Inkling', provider: 'Thinking Machines' },
    { id: 'thinkingmachines/inkling-small:free', name: 'Inkling Small', provider: 'Thinking Machines' },
    { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1', provider: 'Poolside' }
];

// The model chain actually used by the app (full list by default; reordered
// at startup by setActiveModels once live availability is known).
let activeModelIds = SUPPORTED_MODELS.map((m) => m.id);

export const setActiveModels = (ids) => {
    // Prefer curated ids, but also accept any live :free id the /api/models
    // endpoint returns (OpenRouter rotates free models often).
    const valid = (Array.isArray(ids) ? ids : []).filter(
        (id) => typeof id === 'string' && id.endsWith(':free') && id.length < 200
    );
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
