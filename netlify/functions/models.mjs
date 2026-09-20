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
    { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B A4B', provider: 'Google' },
    { id: 'liquid/lfm-2.5-2.6b:free', name: 'LFM 2.5 2.6B', provider: 'Liquid' },
    { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super 120B', provider: 'NVIDIA' },
    { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', provider: 'Google' },
    { id: 'qwen/qwen3.8-27b:free', name: 'Qwen 3.8 27B', provider: 'Qwen' },
    { id: 'z-ai/glm-5.2:free', name: 'GLM 5.2', provider: 'Z.AI' },
    { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron 3 Nano Omni Reasoning', provider: 'NVIDIA' },
    { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 Lightning', provider: 'NVIDIA' },
    { id: 'cohere/north-mini-code:free', name: 'North Mini Code', provider: 'Cohere' },
    { id: 'thinkingmachines/inkling:free', name: 'Inkling', provider: 'Thinking Machines' },
    { id: 'thinkingmachines/inkling-small:free', name: 'Inkling Small', provider: 'Thinking Machines' },
    { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1', provider: 'Poolside' }
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
    let models = SUPPORTED
        .filter((m) => liveById.has(m.id))
        .map((m) => ({ ...m, contextLength: liveById.get(m.id)?.context_length ?? null }));

    // OpenRouter rotates free models often. If none of our curated ids are
    // live, fall back to whatever :free models are currently listed.
    if (models.length === 0) {
        models = [...liveById.values()]
            .filter((m) => typeof m.id === 'string' && m.id.endsWith(':free'))
            .slice(0, 12)
            .map((m) => {
                const [provider = 'Unknown', rest = m.id] = m.id.split('/');
                const name = rest.replace(/:free$/, '');
                return {
                    id: m.id,
                    name,
                    provider: provider.charAt(0).toUpperCase() + provider.slice(1),
                    contextLength: m.context_length ?? null
                };
            });
    }

    return jsonResponse(200, {
        models,
        source: 'openrouter',
        fetchedAt: new Date().toISOString()
    });
};

export const config = { path: '/api/models' };
