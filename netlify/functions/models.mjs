// Live model availability ranking (Netlify Function v2).
//
//   GET /api/models  →  { models: [{ id, name, provider, contextLength }] }
//
// The curated list below defines our preference order ("best" first). At
// request time it is filtered against OpenRouter's live model list, so the
// returned #1 is the best *currently available* model — it can change on
// every page refresh as models come and go.
//
// Keep SUPPORTED in sync with SUPPORTED_MODELS in src/js/config.js.

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

const SUPPORTED = [
    { id: 'google/gemini-2.0-pro-exp-02-05:free', name: 'Gemini Pro Exp', provider: 'Google' },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'Google' },
    { id: 'google/gemini-exp-1206:free', name: 'Gemini Exp 1206', provider: 'Google' },
    { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', provider: 'Meta' },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B', provider: 'MistralAI' },
    { id: 'qwen/qwen-2-7b-instruct:free', name: 'Qwen 2 7B', provider: 'Qwen' },
    { id: 'huggingfaceh4/zephyr-7b-beta:free', name: 'Zephyr 7B', provider: 'HuggingFace' },
    { id: 'openchat/openchat-7b:free', name: 'OpenChat 7B', provider: 'OpenChat' }
];

const jsonResponse = (status, payload) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

export default async (request) => {
    if (request.method !== 'GET') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    // The OpenRouter models endpoint is public; the key just raises rate limits.
    const headers = { 'Accept': 'application/json' };
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    let live;
    try {
        const res = await fetch(OPENROUTER_MODELS_URL, { headers });
        if (!res.ok) {
            return jsonResponse(502, { error: `OpenRouter models endpoint returned HTTP ${res.status}` });
        }
        live = await res.json();
    } catch (error) {
        return jsonResponse(502, { error: `Could not reach OpenRouter: ${error.message}` });
    }

    const liveById = new Map(
        (Array.isArray(live?.data) ? live.data : []).map((m) => [m.id, m])
    );

    // Filter to live models, keeping the curated preference order.
    const models = SUPPORTED
        .filter((m) => liveById.has(m.id))
        .map((m) => ({ ...m, contextLength: liveById.get(m.id)?.context_length ?? null }));

    return jsonResponse(200, {
        models,
        source: 'openrouter',
        fetchedAt: new Date().toISOString()
    });
};

export const config = { path: '/api/models' };
