// Cleverbot chat proxy (Netlify Function v2).
//
// The OpenRouter API key lives ONLY here, on the server side — the browser
// never sees it. This function validates incoming requests and forwards them
// to OpenRouter, streaming the SSE response back to the client.
//
// Keep ALLOWED_MODELS in sync with SUPPORTED_MODELS in src/js/config.js.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const ALLOWED_MODELS = new Set([
    'google/gemma-4-26b-a4b-it:free',
    'liquid/lfm-2.5-2.6b:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free',
    'qwen/qwen3.8-27b:free',
    'z-ai/glm-5.2:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'nvidia/nemotron-3.5-lightning:free',
    'cohere/north-mini-code:free',
    'thinkingmachines/inkling:free',
    'thinkingmachines/inkling-small:free',
    'poolside/laguna-s-2.1:free'
]);

// Prefer the curated set; also allow any other OpenRouter :free id so
// chat keeps working when the free roster rotates.
const isAllowedModel = (model) =>
    typeof model === 'string'
    && model.length > 0
    && model.length < 200
    && /^[a-z0-9][a-z0-9._/-]*:free$/i.test(model)
    && (ALLOWED_MODELS.has(model) || model.endsWith(':free'));

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 16000;
const MAX_TOTAL_CHARS = 128000;
const DEFAULT_TEMPERATURE = 0.7;

const jsonResponse = (status, payload) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

const upstreamErrorMessage = async (upstream) => {
    try {
        const body = await upstream.json();
        if (body?.error?.message) return String(body.error.message);
    } catch {
        // Upstream error body was not JSON — fall through to the generic message.
    }
    return `Upstream error (HTTP ${upstream.status})`;
};

export default async (request) => {
    if (request.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || !apiKey.startsWith('sk-or-')) {
        console.error('OPENROUTER_API_KEY is missing or malformed in the environment');
        return jsonResponse(500, { error: 'Server is not configured with an OpenRouter API key' });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'Request body must be valid JSON' });
    }

    const { model, messages, temperature = DEFAULT_TEMPERATURE } = body ?? {};

    if (!isAllowedModel(model)) {
        return jsonResponse(400, { error: 'Model not allowed' });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
        return jsonResponse(400, { error: 'messages must be a non-empty array' });
    }
    if (messages.length > MAX_MESSAGES) {
        return jsonResponse(400, { error: `Too many messages (max ${MAX_MESSAGES})` });
    }
    if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
        return jsonResponse(422, { error: 'temperature must be a number between 0 and 2' });
    }

    let totalChars = 0;
    for (const message of messages) {
        if (
            !message ||
            typeof message !== 'object' ||
            !ALLOWED_ROLES.has(message.role) ||
            typeof message.content !== 'string'
        ) {
            return jsonResponse(400, {
                error: 'Each message must be { role: "user"|"assistant"|"system", content: string }'
            });
        }
        if (message.content.length > MAX_CONTENT_CHARS) {
            return jsonResponse(400, { error: `Message exceeds ${MAX_CONTENT_CHARS} characters` });
        }
        totalChars += message.content.length;
    }
    if (totalChars > MAX_TOTAL_CHARS) {
        return jsonResponse(413, { error: 'Conversation too long' });
    }

    let upstream;
    try {
        upstream = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': request.headers.get('origin') || 'https://cleverbot.netlify.app',
                'X-Title': 'Cleverbot'
            },
            body: JSON.stringify({ model, messages, temperature, stream: true })
        });
    } catch (error) {
        return jsonResponse(502, { error: `Could not reach OpenRouter: ${error.message}` });
    }

    if (!upstream.ok) {
        const message = await upstreamErrorMessage(upstream);
        const status = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
        return jsonResponse(status, { error: message });
    }

    // Passthrough: forward the SSE stream to the browser unchanged.
    return new Response(upstream.body, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
};

// Serve this function at /api/chat (config.path takes priority over redirects;
// the /api/* redirect in netlify.toml is a fallback).
export const config = { path: '/api/chat' };
