// Cleverbot chat proxy (Netlify Function v2).
//
// The OpenRouter API key lives ONLY here, on the server side — the browser
// never sees it. This function validates incoming requests and forwards them
// to OpenRouter, streaming the SSE response back to the client.
//
// Any live OpenRouter `:free` model id is allowed (plus the `openrouter/free`
// router). Model preference is decided client-side from GET /api/models.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const isAllowedModel = (model) =>
    typeof model === 'string'
    && model.length > 0
    && model.length < 200
    && (
        model === 'openrouter/free'
        || (/^[a-z0-9][a-z0-9._/-]*:free$/i.test(model) && model.endsWith(':free'))
    );

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 16000;
const MAX_TOTAL_CHARS = 128000;
const MAX_IMAGE_DATA_URL_CHARS = 7_000_000; // ~5MB binary as base64 data URL
const MAX_PARTS_PER_MESSAGE = 12;
const DEFAULT_TEMPERATURE = 0.7;

// Always attach OpenRouter web search. Works with any model (including :free);
// server tools need tool-calling which many free models lack. Web search uses
// OpenRouter credits even when the model itself is free.
const WEB_SEARCH_PLUGIN = {
    id: 'web',
    max_results: 5
};

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

const isDataImageUrl = (url) =>
    typeof url === 'string'
    && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(url)
    && url.length <= MAX_IMAGE_DATA_URL_CHARS;

const isHttpImageUrl = (url) =>
    typeof url === 'string'
    && /^https?:\/\//i.test(url)
    && url.length < 4000;

/** Validate string or OpenAI-style multimodal content; returns char count. */
const validateContent = (content) => {
    if (typeof content === 'string') {
        if (content.length > MAX_CONTENT_CHARS) {
            return { ok: false, error: `Message exceeds ${MAX_CONTENT_CHARS} characters` };
        }
        return { ok: true, chars: content.length };
    }

    if (!Array.isArray(content)) {
        return {
            ok: false,
            error: 'Each message content must be a string or an array of text/image_url parts'
        };
    }
    if (content.length === 0 || content.length > MAX_PARTS_PER_MESSAGE) {
        return {
            ok: false,
            error: `Multimodal content must have 1–${MAX_PARTS_PER_MESSAGE} parts`
        };
    }

    let chars = 0;
    for (const part of content) {
        if (!part || typeof part !== 'object') {
            return { ok: false, error: 'Invalid content part' };
        }
        if (part.type === 'text') {
            if (typeof part.text !== 'string') {
                return { ok: false, error: 'text parts require a string text field' };
            }
            if (part.text.length > MAX_CONTENT_CHARS) {
                return { ok: false, error: `Message exceeds ${MAX_CONTENT_CHARS} characters` };
            }
            chars += part.text.length;
            continue;
        }
        if (part.type === 'image_url') {
            const url = part.image_url?.url ?? part.image_url;
            if (!isDataImageUrl(url) && !isHttpImageUrl(url)) {
                return {
                    ok: false,
                    error: 'image_url must be a data:image/(png|jpeg|webp|gif) URL (≤5MB) or https URL'
                };
            }
            chars += typeof url === 'string' ? Math.min(url.length, 256) : 0;
            continue;
        }
        return { ok: false, error: 'Content parts must be type "text" or "image_url"' };
    }
    return { ok: true, chars };
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
            !ALLOWED_ROLES.has(message.role)
        ) {
            return jsonResponse(400, {
                error: 'Each message must be { role: "user"|"assistant"|"system", content: string | parts[] }'
            });
        }
        const checked = validateContent(message.content);
        if (!checked.ok) {
            return jsonResponse(400, { error: checked.error });
        }
        totalChars += checked.chars;
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
            body: JSON.stringify({
                model,
                messages,
                temperature,
                stream: true,
                plugins: [WEB_SEARCH_PLUGIN]
            })
        });
    } catch (error) {
        return jsonResponse(502, { error: `Could not reach OpenRouter: ${error.message}` });
    }

    if (!upstream.ok) {
        const message = await upstreamErrorMessage(upstream);
        const status = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
        return jsonResponse(status, { error: message });
    }

    return new Response(upstream.body, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
};

export const config = { path: '/api/chat' };
