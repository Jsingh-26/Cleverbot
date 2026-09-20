import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeApiRequest, processStream, fetchRankedModels } from '../src/lib/api.ts';
import { FALLBACK_MODELS, setActiveModels, getModels } from '../src/lib/config.ts';

const ORIGINAL_FETCH = globalThis.fetch;
const messages = [{ role: 'user', content: 'hello' }];

const sseStream = (...chunks) => {
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
            controller.close();
        }
    });
};

describe('client api module', () => {
    afterEach(() => {
        globalThis.fetch = ORIGINAL_FETCH;
        setActiveModels(FALLBACK_MODELS.map((m) => m.id));
    });

    it('returns success with the raw response on HTTP 200', async () => {
        globalThis.fetch = async () => new Response('ok', { status: 200 });

        const result = await makeApiRequest(messages, 0);
        assert.equal(result.success, true);
        assert.ok(result.response instanceof Response);
        assert.equal(result.modelId, getModels()[0]);
    });

    it('fails immediately on non-retryable 4xx (no retries)', async () => {
        let calls = 0;
        globalThis.fetch = async () => {
            calls++;
            return new Response(JSON.stringify({ error: 'bad request' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        };

        const result = await makeApiRequest(messages, 0);
        assert.equal(result.success, false);
        assert.equal(result.error, 'bad request');
        assert.equal(result.status, 400);
        assert.equal(calls, 1);
    });

    it('retries transient statuses, then gives up', async () => {
        let calls = 0;
        globalThis.fetch = async () => {
            calls++;
            return new Response(JSON.stringify({ error: 'rate limited' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' }
            });
        };

        const result = await makeApiRequest(messages, 0, { maxRetries: 1 });
        assert.equal(result.success, false);
        assert.equal(result.error, 'rate limited');
        assert.equal(calls, 2);
    });

    it('fails gracefully for unknown model indexes', async () => {
        const result = await makeApiRequest(messages, 99);
        assert.equal(result.success, false);
    });
});

describe('fetchRankedModels', () => {
    afterEach(() => {
        globalThis.fetch = ORIGINAL_FETCH;
        setActiveModels(FALLBACK_MODELS.map((m) => m.id));
    });

    it('returns ranked model objects from the server', async () => {
        globalThis.fetch = async (url) => {
            assert.match(String(url), /\/api\/models$/);
            return new Response(JSON.stringify({
                models: [{ id: 'a/x:free', name: 'X' }, { id: 'b/y:free', name: 'Y' }]
            }), { status: 200 });
        };

        const ranked = await fetchRankedModels();
        assert.deepEqual(ranked.map((m) => m.id), ['a/x:free', 'b/y:free']);
    });

    it('passes images=1 when requested', async () => {
        globalThis.fetch = async (url) => {
            assert.match(String(url), /images=1/);
            return new Response(JSON.stringify({
                models: [{ id: 'vision/x:free' }]
            }), { status: 200 });
        };
        const ranked = await fetchRankedModels({ hasImages: true });
        assert.equal(ranked[0].id, 'vision/x:free');
    });

    it('returns null when the check fails', async () => {
        globalThis.fetch = async () => new Response('nope', { status: 502 });
        assert.equal(await fetchRankedModels(), null);
    });

    it('setActiveModels keeps live :free ids and openrouter/free', () => {
        setActiveModels(['hack/not-real:free', 'openrouter/free', 'paid/model']);
        assert.deepEqual(getModels(), ['hack/not-real:free', 'openrouter/free']);
        setActiveModels(FALLBACK_MODELS.map((m) => m.id));
        assert.equal(getModels()[0], FALLBACK_MODELS[0].id);
    });
});

describe('processStream', () => {
    it('assembles deltas split across chunk boundaries', async () => {
        const stream = sseStream(
            'data: {"choices":[{"delta":{"content":"Hel',
            'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n'
        );

        const parts = [];
        const { received } = await processStream(new Response(stream), (text) => parts.push(text));
        assert.equal(received, true);
        assert.equal(parts.join(''), 'Hello world');
    });

    it('reports no content for a [DONE]-only stream', async () => {
        const { received } = await processStream(
            new Response(sseStream('data: [DONE]\n\n')),
            () => {}
        );
        assert.equal(received, false);
    });
});
