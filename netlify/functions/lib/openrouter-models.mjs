// Shared live free-model ranking for Cleverbot.
// Used by GET /api/models and by /api/chat auto-routing.
// There is NO curated "best model" allowlist — we score whatever
// OpenRouter currently lists as :free.

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const MAX_RETURN = 12;
export const OPENROUTER_FREE_ROUTER = 'openrouter/free';

/** Free models that are not useful as general chat backends. */
export const DENY_RE =
    /embed|embedding|rerank|ranker|content-safety|moderat|whisper|tts|transcri|speech-to-text|asr|clip-vit|vision-encoder|guardrail/i;

const CODE_ID_RE = /code|coder|codex|dev|program|starcoder|deepseek-coder|qwen.*coder|codestral/i;
const WRITE_ID_RE = /instruct|chat|llama|gemma|mistral|qwen|phi|nemotron/i;

/**
 * Lightweight task hint from the latest user message (+ attachment/multimodal flags).
 * Heuristic only — no extra LLM call.
 * Priority: vision > code > write > chat (default).
 * - vision: images attached or multimodal image_url parts
 * - code: fences, language keywords, debug/compile/stack-trace signals, file extensions
 * - write: essay/blog/email/creative soft boost (optional)
 * - chat: general Q&A / everything else
 */
export const detectTask = (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) return 'chat';

    let latestUser = null;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') {
            latestUser = messages[i];
            break;
        }
    }
    if (!latestUser) return 'chat';

    const content = latestUser.content;
    let text = '';
    let hasImage = false;

    if (typeof content === 'string') {
        text = content;
    } else if (Array.isArray(content)) {
        for (const part of content) {
            if (part?.type === 'image_url') hasImage = true;
            if (part?.type === 'text' && typeof part.text === 'string') {
                text += (text ? '\n' : '') + part.text;
            }
        }
    }

    if (hasImage) return 'vision';

    const lower = text.toLowerCase();

    // Code signals: fences, stack traces, common language/tool keywords, file extensions.
    const codeSignals =
        /```/.test(text)
        || /\b(function|def |class |import |from |const |let |var |async |await |console\.|printf|println|traceback|stack trace|compile|debug|refactor|typescript|javascript|python|golang|rustc|webpack|npm |pip |cargo |git diff|eslint|prettier)\b/i.test(text)
        || /\.(js|ts|tsx|jsx|py|go|rs|java|cpp|c|h|rb|php|cs|kt|swift|sql|sh|bash|yml|yaml|json|toml|mdx)\b/i.test(text)
        || /error:\s|exception:|at\s+\w+\.\w+\(/.test(text);

    if (codeSignals) return 'code';

    // Soft writing signals — only when clearly creative / long-form.
    const writeSignals =
        /\b(essay|blog post|write (me )?(a|an|the)|draft (an? )?email|cover letter|poem|short story|creative writing|rewrite this|proofread|linkedin post|newsletter)\b/i.test(lower);

    if (writeSignals) return 'write';

    return 'chat';
};

export const providerFromId = (id) => {
    const [provider = 'Unknown'] = id.split('/');
    return provider.charAt(0).toUpperCase() + provider.slice(1);
};

export const displayName = (id, name) => {
    if (typeof name === 'string' && name.trim()) return name.trim();
    const rest = id.includes('/') ? id.split('/').slice(1).join('/') : id;
    return rest.replace(/:free$/i, '');
};

export const inputModalities = (m) => {
    const listed = m?.architecture?.input_modalities;
    if (Array.isArray(listed) && listed.length) {
        return listed.map((x) => String(x).toLowerCase());
    }
    const modality = String(m?.architecture?.modality || '');
    const left = modality.split('->')[0] || '';
    return left.split('+').map((s) => s.trim().toLowerCase()).filter(Boolean);
};

export const acceptsImage = (m) => inputModalities(m).includes('image');

export const isFreeChatCandidate = (m) => {
    if (!m || typeof m.id !== 'string') return false;
    const id = m.id;
    if (!(id.endsWith(':free') || id === OPENROUTER_FREE_ROUTER)) return false;
    if (DENY_RE.test(id) || DENY_RE.test(String(m.name || ''))) return false;
    const outs = m.architecture?.output_modalities;
    if (Array.isArray(outs) && outs.length && !outs.map(String).includes('text')) return false;
    return true;
};

const normalizeTask = (task) => {
    const t = String(task || 'chat').toLowerCase();
    if (t === 'vision' || t === 'code' || t === 'write' || t === 'chat') return t;
    if (t === 'images' || t === 'image') return 'vision';
    return 'chat';
};

/**
 * Score a live free model for a task hint.
 * Higher = better. Base: context length + completion budget.
 * Task overlays: vision needs image input; code boosts coder-ish ids;
 * write lightly prefers instruct/chat with large context.
 */
export const scoreModel = (m, task = 'chat') => {
    const t = normalizeTask(task);
    const ctx = Number(m.context_length) || Number(m.top_provider?.context_length) || 0;
    const maxOut = Number(m.top_provider?.max_completion_tokens) || 0;
    const id = String(m.id || '');
    const name = String(m.name || '');
    const hay = `${id} ${name}`;
    const hasImage = acceptsImage(m);

    let score = ctx * 1e3 + maxOut;

    if (t === 'vision') {
        // Heavy preference for image-capable models; text-only sinks.
        if (hasImage) score += 1e12;
        else score -= 1e9;
    } else if (t === 'code') {
        if (CODE_ID_RE.test(hay)) score += 5e11;
        // Still require text out (already filtered); slight context preference stays in base.
    } else if (t === 'write') {
        if (WRITE_ID_RE.test(hay)) score += 1e10;
        // Soft boost for larger context (long-form).
        score += Math.min(ctx, 200_000);
    }
    // chat: base ranking only (context + completion budget)

    return score;
};

export const toPublicModel = (m) => ({
    id: m.id,
    name: displayName(m.id, m.name),
    provider: providerFromId(m.id),
    contextLength: m.context_length ?? m.top_provider?.context_length ?? null,
    inputModalities: inputModalities(m)
});

/** Fetch OpenRouter catalog and return ranked free chat models for `task`. */
export const fetchRankedFreeModels = async ({ task = 'chat', apiKey, limit = MAX_RETURN } = {}) => {
    const t = normalizeTask(task);
    const headers = { Accept: 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch(OPENROUTER_MODELS_URL, { headers });
    if (!res.ok) {
        const err = new Error(`OpenRouter models endpoint returned HTTP ${res.status}`);
        err.status = 502;
        throw err;
    }
    const live = await res.json();
    const all = Array.isArray(live?.data) ? live.data : [];
    const candidates = all.filter(isFreeChatCandidate);

    candidates.sort((a, b) => scoreModel(b, t) - scoreModel(a, t));

    let models = candidates.slice(0, limit).map(toPublicModel);

    if (models.length === 0) {
        const router = all.find((m) => m.id === OPENROUTER_FREE_ROUTER);
        if (router) models = [toPublicModel(router)];
    }

    return { models, task: t, live };
};
