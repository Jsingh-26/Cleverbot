// Live free-model ranking (Netlify Function v2).
//
//   GET /api/models                         → best general free chat models right now
//   GET /api/models?task=code|vision|write|chat
//   GET /api/models?images=1                → alias for task=vision (compat)
//
// There is NO hand-curated preference list. We fetch OpenRouter's live catalog,
// drop non-chat specialty free models (embeddings, rerankers, safety classifiers),
// and rank the rest by task-aware capability signals.

import { fetchRankedFreeModels } from './lib/openrouter-models.mjs';

const jsonResponse = (status, payload) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

export default async (request) => {
    if (request.method !== 'GET') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    const url = new URL(request.url);
    const imagesFlag = url.searchParams.get('images') === '1'
        || url.searchParams.get('images') === 'true';
    const taskParam = url.searchParams.get('task');
    const task = imagesFlag ? 'vision' : (taskParam || 'chat');

    try {
        const { models, task: resolvedTask } = await fetchRankedFreeModels({
            task,
            apiKey: process.env.OPENROUTER_API_KEY
        });

        return jsonResponse(200, {
            models,
            source: 'openrouter-live',
            task: resolvedTask,
            preferImages: resolvedTask === 'vision',
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        return jsonResponse(502, {
            error: error?.message?.startsWith('OpenRouter')
                ? error.message
                : `Could not reach OpenRouter: ${error.message}`
        });
    }
};

export const config = { path: '/api/models' };
