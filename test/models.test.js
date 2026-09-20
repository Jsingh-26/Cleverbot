import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/models.mjs';

const ORIGINAL_FETCH = globalThis.fetch;

const openrouterPayload = (ids) => JSON.stringify({
    data: ids.map((id) => ({ id, context_length: 4096 }))
});

const get = () => new Request('https://example.net/api/models', { method: 'GET' });

describe('models function', () => {
    beforeEach(() => {
        delete process.env.OPENROUTER_API_KEY; // not required for this endpoint
    });

    afterEach(() => {
        globalThis.fetch = ORIGINAL_FETCH;
    });

    it('returns only live models, preserving curated preference order', async () => {
        // Pretend only these two are live: gemma (preferred) and lfm
        globalThis.fetch = async () => new Response(openrouterPayload([
            'liquid/lfm-2.5-2.6b:free',
            'google/gemma-4-26b-a4b-it:free'
        ]), { status: 200 });

        const response = await handler(get());
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.deepEqual(body.models.map((m) => m.id), [
            'google/gemma-4-26b-a4b-it:free',
            'liquid/lfm-2.5-2.6b:free'
        ]);
        assert.equal(body.models[0].contextLength, 4096);
    });

    it('falls back to live :free models when curated ids are offline', async () => {
        globalThis.fetch = async () => new Response(openrouterPayload(['some/other-model:free']), { status: 200 });

        const response = await handler(get());
        const body = await response.json();
        assert.equal(body.models.length, 1);
        assert.equal(body.models[0].id, 'some/other-model:free');
    });

    it('returns an empty list when no free models are live', async () => {
        globalThis.fetch = async () => new Response(openrouterPayload(['paid/model-only']), { status: 200 });

        const response = await handler(get());
        const body = await response.json();
        assert.deepEqual(body.models, []);
    });

    it('returns 502 when OpenRouter is unreachable', async () => {
        globalThis.fetch = async () => { throw new Error('network down'); };
        const response = await handler(get());
        assert.equal(response.status, 502);
    });

    it('rejects non-GET requests', async () => {
        const response = await handler(new Request('https://example.net/api/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        }));
        assert.equal(response.status, 405);
    });
});
