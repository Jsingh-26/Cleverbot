import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeApiRequest, processStream, fetchRankedModels } from '../src/js/api.js';
import { SUPPORTED_MODELS, setActiveModels, getModels } from '../src/js/config.js';

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
        assert.equal(calls, 2); // initial attempt + 1 retry
    });

    it('fails gracefully for unknown model indexes', async () => {
        const result = await makeApiRequest(messages, 99);
        assert.equal(result.success, false);
    });
});

describe('fetchRankedModels', () => {
    afterEach(() => {
        globalThis.fetch = ORIGINAL_FETCH;
    });

    it('returns ranked model ids from the server', async () => {
        globalThis.fetch = async () => new Response(JSON.stringify({
            models: [{ id: 'a/x:free' }, { id: 'b/y:free' }]
        }), { status: 200 });

        const ids = await fetchRankedModels();
        assert.deepEqual(ids, ['a/x:free', 'b/y:free']);
    });

    it('returns null when the check fails', async () => {
        globalThis.fetch = async () => new Response('nope', { status: 502 });
        assert.equal(await fetchRankedModels(), null);
    });

    it('setActiveModels keeps live :free ids in order and drops non-free', () => {
        const [first, second] = SUPPORTED_MODELS.map((m) => m.id);
        setActiveModels(['hack/not-real:free', second, 'paid/model']);
        assert.deepEqual(getModels(), ['hack/not-real:free', second]);
        setActiveModels(SUPPORTED_MODELS.map((m) => m.id)); // restore
        assert.equal(getModels()[0], first);
    });
});

describe('processStream', () => {
    it('assembles deltas split across chunk boundaries', async () => {
        // One JSON payload is split mid-line across two chunks:
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
