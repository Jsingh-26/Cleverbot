import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/models.mjs';

const ORIGINAL_FETCH = globalThis.fetch;

const openrouterPayload = (models) => JSON.stringify({
    data: models.map((m) => (typeof m === 'string'
        ? { id: m, context_length: 4096, architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] } }
        : m))
});

const get = (qs = '') => new Request(`https://example.net/api/models${qs}`, { method: 'GET' });

describe('models function (live ranking)', () => {
    beforeEach(() => {
        delete process.env.OPENROUTER_API_KEY;
    });

    afterEach(() => {
        globalThis.fetch = ORIGINAL_FETCH;
    });

    it('ranks live :free chat models by context length', async () => {
        globalThis.fetch = async () => new Response(openrouterPayload([
            { id: 'small/chat:free', context_length: 8192, architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] } },
            { id: 'big/chat:free', context_length: 262144, architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] } },
            { id: 'mid/chat:free', context_length: 65536, architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] } }
        ]), { status: 200 });

        const response = await handler(get());
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.deepEqual(body.models.map((m) => m.id), [
            'big/chat:free',
            'mid/chat:free',
            'small/chat:free'
        ]);
        assert.equal(body.source, 'openrouter-live');
    });

    it('excludes specialty free models via denylist', async () => {
        globalThis.fetch = async () => new Response(openrouterPayload([
            'vendor/cool-chat:free',
            'nvidia/nemotron-3.5-content-safety:free',
            'acme/text-embedding:free',
            'acme/rerank-v2:free'
        ]), { status: 200 });

        const response = await handler(get());
        const body = await response.json();
        assert.deepEqual(body.models.map((m) => m.id), ['vendor/cool-chat:free']);
    });

    it('prefers image-capable models when ?images=1', async () => {
        globalThis.fetch = async () => new Response(openrouterPayload([
            {
                id: 'text/only:free',
                context_length: 1_000_000,
                architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] }
            },
            {
                id: 'vision/model:free',
                context_length: 32_000,
                architecture: { modality: 'text+image->text', input_modalities: ['text', 'image'], output_modalities: ['text'] }
            }
        ]), { status: 200 });

        const response = await handler(get('?images=1'));
        const body = await response.json();
        assert.equal(body.preferImages, true);
        assert.equal(body.models[0].id, 'vision/model:free');
        assert.ok(body.models.some((m) => m.id === 'text/only:free'));
    });

    it('falls back to openrouter/free when nothing else qualifies', async () => {
        globalThis.fetch = async () => new Response(openrouterPayload([
            'acme/embed-only:free',
            {
                id: 'openrouter/free',
                context_length: 128000,
                architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] }
            }
        ]), { status: 200 });

        const response = await handler(get());
        const body = await response.json();
        // embed denied; openrouter/free is a candidate itself so it ranks normally
        assert.equal(body.models[0].id, 'openrouter/free');
    });

    it('returns empty list when no free chat models are live', async () => {
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
