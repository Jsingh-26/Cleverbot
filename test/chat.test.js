import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler, { needsWebSearch } from '../netlify/functions/chat.mjs';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_KEY = process.env.OPENROUTER_API_KEY;
const ALLOWED_MODEL = 'google/gemma-4-26b-a4b-it:free';

const makeRequest = (body, method = 'POST') =>
    new Request('https://example.net/api/chat', {
        method,
        headers: { 'Content-Type': 'application/json', 'origin': 'https://example.net' },
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {})
    });

const validMessage = (content = 'hello') => [{ role: 'user', content }];

const modelsCatalog = (models) => JSON.stringify({
    data: models.map((m) => (typeof m === 'string'
        ? {
            id: m,
            context_length: 8192,
            architecture: {
                modality: 'text->text',
                input_modalities: ['text'],
                output_modalities: ['text']
            }
        }
        : m))
});

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

    it('rejects paid / non-free models', async () => {
        const response = await handler(makeRequest({
            model: 'openai/gpt-4o',
            messages: validMessage()
        }));
        assert.equal(response.status, 400);
        const body = await response.json();
        assert.match(body.error, /not allowed/i);
    });

    it('allows openrouter/free router id', async () => {
        globalThis.fetch = async () => new Response('data: [DONE]\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' }
        });
        const response = await handler(makeRequest({
            model: 'openrouter/free',
            messages: validMessage()
        }));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('X-Model-Id'), 'openrouter/free');
    });

    it('auto-routes when model is omitted', async () => {
        let chatBody;
        globalThis.fetch = async (url, options) => {
            const href = String(url);
            if (href.includes('/models')) {
                return new Response(modelsCatalog([
                    { id: 'big/chat:free', context_length: 100000, architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] } },
                    { id: 'small/chat:free', context_length: 8000, architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] } }
                ]), { status: 200 });
            }
            chatBody = JSON.parse(options.body);
            return new Response('data: [DONE]\n\n', { status: 200 });
        };

        const response = await handler(makeRequest({
            messages: validMessage('What is 2+2?')
        }));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('X-Model-Id'), 'big/chat:free');
        assert.equal(response.headers.get('X-Task'), 'chat');
        assert.equal(chatBody.model, 'big/chat:free');
        const text = await response.text();
        assert.match(text, /: model big\/chat:free/);
    });

    it('auto-routes when model is "auto" and prefers coder for code tasks', async () => {
        let chatBody;
        globalThis.fetch = async (url, options) => {
            const href = String(url);
            if (href.includes('/models')) {
                return new Response(modelsCatalog([
                    { id: 'vendor/huge-chat:free', context_length: 200000, architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] } },
                    { id: 'vendor/dev-coder:free', context_length: 32000, architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] } }
                ]), { status: 200 });
            }
            chatBody = JSON.parse(options.body);
            return new Response('data: [DONE]\n\n', { status: 200 });
        };

        const response = await handler(makeRequest({
            model: 'auto',
            messages: validMessage('```python\ndef foo():\n  pass\n``` please debug this')
        }));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('X-Model-Id'), 'vendor/dev-coder:free');
        assert.equal(response.headers.get('X-Task'), 'code');
        assert.equal(chatBody.model, 'vendor/dev-coder:free');
    });

    it('auto-routes vision tasks to image-capable free models', async () => {
        let chatBody;
        globalThis.fetch = async (url, options) => {
            const href = String(url);
            if (href.includes('/models')) {
                return new Response(modelsCatalog([
                    { id: 'text/only:free', context_length: 1_000_000, architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] } },
                    { id: 'vision/model:free', context_length: 32_000, architecture: { modality: 'text+image->text', input_modalities: ['text', 'image'], output_modalities: ['text'] } }
                ]), { status: 200 });
            }
            chatBody = JSON.parse(options.body);
            return new Response('data: [DONE]\n\n', { status: 200 });
        };

        const tinyPng = 'data:image/png;base64,iVBORw0KGgo=';
        const response = await handler(makeRequest({
            model: 'auto',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'describe this' },
                    { type: 'image_url', image_url: { url: tinyPng } }
                ]
            }]
        }));
        assert.equal(response.status, 200);
        assert.equal(chatBody.model, 'vision/model:free');
        assert.equal(response.headers.get('X-Task'), 'vision');
    });

    it('rejects malformed message arrays', async () => {
        for (const bad of [undefined, [], 'hello', [{ role: 'admin', content: 'x' }], [{ role: 'user', content: 42 }]]) {
            const response = await handler(makeRequest({ model: ALLOWED_MODEL, messages: bad }));
            assert.equal(response.status, 400, `expected 400 for messages=${JSON.stringify(bad)}`);
        }
    });

    it('accepts multimodal content arrays with text + image_url', async () => {
        let capturedBody;
        globalThis.fetch = async (_url, options) => {
            capturedBody = JSON.parse(options.body);
            return new Response('data: [DONE]\n\n', { status: 200 });
        };

        const tinyPng = 'data:image/png;base64,iVBORw0KGgo=';
        const response = await handler(makeRequest({
            model: ALLOWED_MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'what is in this image?' },
                    { type: 'image_url', image_url: { url: tinyPng } }
                ]
            }]
        }));
        assert.equal(response.status, 200);
        assert.equal(capturedBody.messages[0].content[1].type, 'image_url');
    });

    it('rejects invalid image_url parts', async () => {
        const response = await handler(makeRequest({
            model: ALLOWED_MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'hi' },
                    { type: 'image_url', image_url: { url: 'javascript:alert(1)' } }
                ]
            }]
        }));
        assert.equal(response.status, 400);
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
        assert.equal(response.headers.get('X-Model-Id'), ALLOWED_MODEL);
        assert.equal(capturedBody.model, ALLOWED_MODEL);
        assert.equal(capturedBody.stream, true);
        assert.equal('plugins' in capturedBody, false);
        const text = await response.text();
        assert.match(text, /data: /);
        assert.match(text, /: model google\/gemma-4-26b-a4b-it:free/);
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


describe('conditional web search', () => {
    it('uses search for explicit and time-sensitive requests', () => {
        assert.equal(needsWebSearch(validMessage('Search the web for this')), true);
        assert.equal(needsWebSearch(validMessage('What is the weather today?')), true);
        assert.equal(needsWebSearch(validMessage('Who is the current prime minister?')), true);
    });

    it('does not spend search credits on ordinary prompts', () => {
        assert.equal(needsWebSearch(validMessage('Explain recursion simply')), false);
        assert.equal(needsWebSearch(validMessage('Write a poem about rain')), false);
        assert.equal(needsWebSearch(validMessage('Refactor this function')), false);
    });

    it('omits plugins for ordinary chat and includes them for current facts', async () => {
        process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
        const bodies = [];
        globalThis.fetch = async (_url, options) => {
            bodies.push(JSON.parse(options.body));
            return new Response('data: [DONE]\n\n', { status: 200 });
        };
        await handler(makeRequest({ model: ALLOWED_MODEL, messages: validMessage('Explain recursion') }));
        await handler(makeRequest({ model: ALLOWED_MODEL, messages: validMessage('What is the weather today?') }));
        assert.equal('plugins' in bodies[0], false);
        assert.deepEqual(bodies[1].plugins, [{ id: 'web', max_results: 5 }]);

        bodies.length = 0;
        const forced = await handler(new Request('https://example.test/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openrouter/free',
                messages: validMessage('Explain closures'),
                forceWebSearch: true
            })
        }));
        assert.equal(forced.status, 200);
        assert.deepEqual(bodies[0].plugins, [{ id: 'web', max_results: 5 }]);

    });
});
