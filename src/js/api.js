import { CHAT_ENDPOINT, MODELS_ENDPOINT, getModels } from './config.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Statuses where retrying the same model is worthwhile (rate limits, server hiccups)
const isRetryable = (status) => status === 408 || status === 429 || (status >= 500 && status <= 599);

const readErrorMessage = async (response) => {
    try {
        const data = await response.json();
        if (data?.error) return String(data.error);
    } catch {
        // Error body was not JSON
    }
    return `Request failed with HTTP ${response.status}`;
};

// Ask the server which supported models are currently live, best first.
// Returns an array of model ids, or null if the check failed (caller falls
// back to the static order).
export const fetchRankedModels = async () => {
    try {
        const response = await fetch(MODELS_ENDPOINT, {
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const ids = Array.isArray(data?.models) ? data.models.map((m) => m.id) : [];
        return ids.length ? ids : null;
    } catch (error) {
        console.warn('Model availability check failed:', error.message);
        return null;
    }
};

// POST the conversation to the serverless proxy and return the raw SSE response.
// Retries transient failures with exponential backoff; permanent errors (4xx)
// return immediately so the caller can fall back to the next model.
export const makeApiRequest = async (messages, modelIndex, { maxRetries = 2, signal, temperature = 0.7 } = {}) => {
    const modelId = getModels()[modelIndex];
    if (!modelId) {
        return { success: false, error: `No model configured at index ${modelIndex}` };
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(CHAT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelId, messages, temperature, stream: true }),
                signal
            });

            if (!response.ok) {
                const error = await readErrorMessage(response);
                if (isRetryable(response.status) && attempt < maxRetries) {
                    await sleep(2 ** attempt * 1000);
                    continue;
                }
                return { success: false, error, status: response.status, modelId };
            }

            return { success: true, response, modelId };
        } catch (error) {
            if (error.name === 'AbortError') {
                return { success: false, error: 'Request cancelled', aborted: true, modelId };
            }
            if (attempt === maxRetries) {
                return { success: false, error: error.message, modelId };
            }
            await sleep(2 ** attempt * 1000);
        }
    }
};

// Consumes an OpenRouter SSE stream and calls onChunk(text) for every content
// delta. Handles JSON payloads split across chunk boundaries and the
// [DONE] terminator. Returns whether any content was received.
export const processStream = async (response, onChunk) => {
    if (!response.body) {
        throw new Error('Response has no readable body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let received = false;

    const handleLine = (rawLine) => {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) return;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') return;
        try {
            const parsed = JSON.parse(data);
            const content = parsed?.choices?.[0]?.delta?.content;
            if (typeof content === 'string' && content.length > 0) {
                received = true;
                onChunk(content);
            }
        } catch {
            // Non-JSON control line — ignore
        }
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? ''; // the last piece may be an incomplete line
            for (const line of lines) handleLine(line);
        }
        buffer += decoder.decode();
        if (buffer) handleLine(buffer);
    } finally {
        reader.releaseLock();
    }

    return { received };
};
