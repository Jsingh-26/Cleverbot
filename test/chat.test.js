import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/chat.mjs';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_KEY = process.env.OPENROUTER_API_KEY;
const ALLOWED_MODEL = 'google/gemma-4-31b-it:free';

const makeRequest = (body, method = 'POST') =>
    new Request('https://example.net/api/chat', {
        method,
        headers: { 'Content-Type': 'application/json', 'origin': 'https://example.net' },
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {})
    });

const validMessage = (content = 'hello') => [{ role: 'user', content }];

describe('chat serverless function', () => {
    beforeEach(() => {
        process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
    });

    afterEach(() => {
        globalThis.fetch = ORIGINAL_FETCH;
        if (ORIGINAL_KEY === undefined) {
            delete process.env.OPENROUTER_API_KEY;
        } else {
            process.env.OPENROUTER_API_KEY = ORIGINAL_KEY;
        }
    });

    it('rejects non-POST requests', async () => {
        const response = await handler(makeRequest({}, 'GET'));
        assert.equal(response.status, 405);
    });

    it('returns 500 when the API key is not configured', async () => {
        delete process.env.OPENROUTER_API_KEY;
        const response = await handler(makeRequest({
            model: ALLOWED_MODEL,
            messages: validMessage()
        }));
        assert.equal(response.status, 500);
    });

    it('rejects invalid JSON bodies', async () => {
        const response = await handler(new Request('https://example.net/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'this is not json'
        }));
        assert.equal(response.status, 400);
    });

    it('rejects models outside the allowlist', async () => {
        const response = await handler(makeRequest({
            model: 'openai/gpt-4o',
            messages: validMessage()
        }));
        assert.equal(response.status, 400);
        const body = await response.json();
        assert.match(body.error, /not allowed/i);
    });

    it('rejects malformed message arrays', async () => {
        for (const bad of [undefined, [], 'hello', [{ role: 'admin', content: 'x' }], [{ role: 'user', content: 42 }]]) {
            const response = await handler(makeRequest({ model: ALLOWED_MODEL, messages: bad }));
            assert.equal(response.status, 400, `expected 400 for messages=${JSON.stringify(bad)}`);
        }
    });

    it('rejects invalid temperature values', async () => {
        for (const temperature of ['hot', -1, 3]) {
            const response = await handler(makeRequest({
                model: ALLOWED_MODEL,
                messages: validMessage(),
                temperature
            }));
            assert.equal(response.status, 422, `expected 422 for temperature=${temperature}`);
        }
    });

    it('streams the upstream SSE response back to the client', async () => {
        const encoder = new TextEncoder();
        const sse = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            }
        });

        let capturedBody;
        globalThis.fetch = async (_url, options) => {
            capturedBody = JSON.parse(options.body);
            return new Response(sse, { status: 200 });
        };

        const response = await handler(makeRequest({
            model: ALLOWED_MODEL,
            messages: validMessage()
        }));

        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /text\/event-stream/);
        assert.equal(capturedBody.model, ALLOWED_MODEL);
        assert.equal(capturedBody.stream, true);
        const text = await response.text();
        assert.match(text, /data: /);
    });

    it('forwards upstream errors with status and message', async () => {
        globalThis.fetch = async () => new Response(
            JSON.stringify({ error: { message: 'Model overloaded' } }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
        );

        const response = await handler(makeRequest({
            model: ALLOWED_MODEL,
            messages: validMessage()
        }));

        assert.equal(response.status, 429);
        const body = await response.json();
        assert.equal(body.error, 'Model overloaded');
    });
});
