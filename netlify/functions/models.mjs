// Live free-model ranking (Netlify Function v2).
//
//   GET /api/models           → best general free chat models right now
//   GET /api/models?images=1  → same, but prefer models that accept image input
//
// There is NO hand-curated preference list. We fetch OpenRouter's live catalog,
// drop non-chat specialty free models (embeddings, rerankers, safety classifiers),
// and rank the rest by context / capability signals.

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const MAX_RETURN = 12;
const OPENROUTER_FREE_ROUTER = 'openrouter/free';

/** Free models that are not useful as general chat backends. */
const DENY_RE =
    /embed|embedding|rerank|ranker|content-safety|moderat|whisper|tts|transcri|speech-to-text|asr|clip-vit|vision-encoder|guardrail/i;

const jsonResponse = (status, payload) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

const providerFromId = (id) => {
    const [provider = 'Unknown'] = id.split('/');
    return provider.charAt(0).toUpperCase() + provider.slice(1);
};

const displayName = (id, name) => {
    if (typeof name === 'string' && name.trim()) return name.trim();
    const rest = id.includes('/') ? id.split('/').slice(1).join('/') : id;
    return rest.replace(/:free$/i, '');
};

const inputModalities = (m) => {
    const listed = m?.architecture?.input_modalities;
    if (Array.isArray(listed) && listed.length) {
        return listed.map((x) => String(x).toLowerCase());
    }
    const modality = String(m?.architecture?.modality || '');
    const left = modality.split('->')[0] || '';
    return left.split('+').map((s) => s.trim().toLowerCase()).filter(Boolean);
};

const acceptsImage = (m) => inputModalities(m).includes('image');

const isFreeChatCandidate = (m) => {
    if (!m || typeof m.id !== 'string') return false;
    const id = m.id;
    if (!(id.endsWith(':free') || id === OPENROUTER_FREE_ROUTER)) return false;
    if (DENY_RE.test(id) || DENY_RE.test(String(m.name || ''))) return false;
    const outs = m.architecture?.output_modalities;
    if (Array.isArray(outs) && outs.length && !outs.map(String).includes('text')) return false;
    return true;
};

/** Higher score = better for general chat (and optionally vision). */
const scoreModel = (m, wantImages) => {
    const ctx = Number(m.context_length) || Number(m.top_provider?.context_length) || 0;
    const maxOut = Number(m.top_provider?.max_completion_tokens) || 0;
    const imageBonus = wantImages && acceptsImage(m) ? 1e12 : 0;
    // Prefer large context, then large completion budget. Tiny models sink.
    return imageBonus + ctx * 1e3 + maxOut;
};

export default async (request) => {
    if (request.method !== 'GET') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    const url = new URL(request.url);
    const wantImages = url.searchParams.get('images') === '1'
        || url.searchParams.get('images') === 'true';

    const headers = { Accept: 'application/json' };
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

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

    const candidates = (Array.isArray(live?.data) ? live.data : []).filter(isFreeChatCandidate);

    candidates.sort((a, b) => scoreModel(b, wantImages) - scoreModel(a, wantImages));

    let models = candidates.slice(0, MAX_RETURN).map((m) => ({
        id: m.id,
        name: displayName(m.id, m.name),
        provider: providerFromId(m.id),
        contextLength: m.context_length ?? m.top_provider?.context_length ?? null,
        inputModalities: inputModalities(m)
    }));

    // Last-resort router if ranking somehow produced nothing.
    if (models.length === 0) {
        const router = (Array.isArray(live?.data) ? live.data : [])
            .find((m) => m.id === OPENROUTER_FREE_ROUTER);
        if (router) {
            models = [{
                id: OPENROUTER_FREE_ROUTER,
                name: 'OpenRouter Free',
                provider: 'Openrouter',
                contextLength: router.context_length ?? null,
                inputModalities: inputModalities(router)
            }];
        }
    }

    return jsonResponse(200, {
        models,
        source: 'openrouter-live',
        preferImages: wantImages,
        fetchedAt: new Date().toISOString()
    });
};

export const config = { path: '/api/models' };
