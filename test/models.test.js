import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/models.mjs';
import { detectTask, scoreModel } from '../netlify/functions/lib/openrouter-models.mjs';

const ORIGINAL_FETCH = globalThis.fetch;

const openrouterPayload = (models) => JSON.stringify({
    data: models.map((m) => (typeof m === 'string'
        ? { id: m, context_length: 4096, architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] } }
        : m))
});

const get = (qs = '') => new Request(`https://example.net/api/models${qs}`, { method: 'GET' });

describe('detectTask heuristic', () => {
    it('returns vision when multimodal image parts are present', () => {
        assert.equal(detectTask([{
            role: 'user',
            content: [
                { type: 'text', text: 'what is this?' },
                { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }
            ]
        }]), 'vision');
    });

    it('returns code for fences and coding keywords', () => {
        assert.equal(detectTask([{ role: 'user', content: '```js\nfunction foo(){}\n```' }]), 'code');
        assert.equal(detectTask([{ role: 'user', content: 'Please debug this stack trace' }]), 'code');
        assert.equal(detectTask([{ role: 'user', content: 'fix src/app.ts compile error' }]), 'code');
    });

    it('returns write for soft creative / long-form signals', () => {
        assert.equal(detectTask([{ role: 'user', content: 'Write me a blog post about tea' }]), 'write');
        assert.equal(detectTask([{ role: 'user', content: 'Draft an email to my manager' }]), 'write');
    });

    it('defaults to chat', () => {
        assert.equal(detectTask([{ role: 'user', content: 'What is the capital of France?' }]), 'chat');
    });
});

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
        assert.equal(body.task, 'chat');
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

    it('prefers image-capable models when ?task=vision (and ?images=1)', async () => {
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

        for (const qs of ['?task=vision', '?images=1']) {
            const response = await handler(get(qs));
            const body = await response.json();
            assert.equal(body.task, 'vision');
            assert.equal(body.preferImages, true);
            assert.equal(body.models[0].id, 'vision/model:free');
            assert.ok(body.models.some((m) => m.id === 'text/only:free'));
        }
    });

    it('boosts coder-named models for ?task=code', async () => {
        globalThis.fetch = async () => new Response(openrouterPayload([
            {
                id: 'vendor/huge-chat:free',
                context_length: 200_000,
                architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] }
            },
            {
                id: 'vendor/qwen-coder:free',
                context_length: 32_000,
                architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] }
            }
        ]), { status: 200 });

        const response = await handler(get('?task=code'));
        const body = await response.json();
        assert.equal(body.task, 'code');
        assert.equal(body.models[0].id, 'vendor/qwen-coder:free');
    });

    it('soft-boosts instruct/chat models for ?task=write', async () => {
        const instruct = {
            id: 'meta/llama-instruct:free',
            name: 'Llama Instruct',
            context_length: 32_000,
            architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] }
        };
        const obscure = {
            id: 'vendor/obscure-base:free',
            name: 'Obscure Base',
            context_length: 40_000,
            architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] }
        };
        assert.ok(scoreModel(instruct, 'write') > scoreModel(obscure, 'write'));

        globalThis.fetch = async () => new Response(openrouterPayload([obscure, instruct]), { status: 200 });
        const response = await handler(get('?task=write'));
        const body = await response.json();
        assert.equal(body.task, 'write');
        assert.equal(body.models[0].id, 'meta/llama-instruct:free');
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
