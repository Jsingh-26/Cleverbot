// Client-side configuration.
//
// There is deliberately NO API key here. The browser only talks to the
// same-origin serverless functions below, which hold the OpenRouter key on
// the server (netlify/functions/chat.mjs).
//
// Model preference is NOT curated here. On each new chat (and initial load)
// the client calls GET /api/models, which ranks live OpenRouter :free models.

export const CHAT_ENDPOINT = '/api/chat';
export const MODELS_ENDPOINT = '/api/models';

/** Tiny offline fallback if /api/models is unreachable. Not a preference list. */
export const FALLBACK_MODELS = [
  { id: 'openrouter/free', name: 'OpenRouter Free', provider: 'Openrouter' },
] as const;

export type ModelInfo = {
  id: string;
  name: string;
  provider: string;
};

let activeModelIds: string[] = FALLBACK_MODELS.map((m) => m.id);
const modelMeta = new Map<string, ModelInfo>(
  FALLBACK_MODELS.map((m) => [m.id, { id: m.id, name: m.name, provider: m.provider }]),
);

const isUsableModelId = (id: string) =>
  typeof id === 'string'
  && id.length > 0
  && id.length < 200
  && (id === 'openrouter/free' || id.endsWith(':free'));

export const setActiveModels = (
  ids: string[] | null | undefined,
  meta?: Array<{ id: string; name?: string; provider?: string }> | null,
) => {
  const valid = (Array.isArray(ids) ? ids : []).filter(isUsableModelId);
  if (valid.length > 0) activeModelIds = [...valid];
  if (Array.isArray(meta)) {
    for (const m of meta) {
      if (!m?.id || !isUsableModelId(m.id)) continue;
      modelMeta.set(m.id, {
        id: m.id,
        name: m.name || m.id,
        provider: m.provider || m.id.split('/')[0] || 'Unknown',
      });
    }
  }
};

export const getModels = (): string[] => [...activeModelIds];

export const getModelInfo = (modelId: string): ModelInfo =>
  modelMeta.get(modelId) ?? (() => {
    const [provider = 'Unknown', name = modelId] = (modelId || '').split('/');
    return { id: modelId, name, provider };
  })();

export const formatModelName = (modelId: string) => {
  const info = getModelInfo(modelId);
  return `${info.provider} - ${info.name}`;
};

/** @deprecated Use FALLBACK_MODELS / live /api/models. Kept for older tests. */
export const SUPPORTED_MODELS = FALLBACK_MODELS;
