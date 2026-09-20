import { CHAT_ENDPOINT, MODELS_ENDPOINT, getModels, setActiveModels } from './config';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (status: number) =>
  status === 408 || status === 429 || (status >= 500 && status <= 599);

const readErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    if (data?.error) return String(data.error);
  } catch {
    // Error body was not JSON
  }
  return `Request failed with HTTP ${response.status}`;
};

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
};

export type ApiRequestResult =
  | { success: true; response: Response; modelId: string }
  | {
      success: false;
      error: string;
      status?: number;
      modelId?: string;
      aborted?: boolean;
    };

export type RankedModel = {
  id: string;
  name?: string;
  provider?: string;
  contextLength?: number | null;
  inputModalities?: string[];
};

/** Fetch live ranked free models. Pass hasImages to prefer vision-capable ones. */
export const fetchRankedModels = async (
  opts: { hasImages?: boolean } = {},
): Promise<RankedModel[] | null> => {
  try {
    const url = opts.hasImages
      ? `${MODELS_ENDPOINT}?images=1`
      : MODELS_ENDPOINT;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    const ranked: RankedModel[] = models
      .filter((m: { id?: string }) => typeof m?.id === 'string')
      .map((m: RankedModel) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        contextLength: m.contextLength ?? null,
        inputModalities: m.inputModalities,
      }));
    return ranked.length ? ranked : null;
  } catch (error) {
    console.warn('Model availability check failed:', (error as Error).message);
    return null;
  }
};

/** Refresh session model order from /api/models and apply it. */
export const refreshSessionModels = async (opts: { hasImages?: boolean } = {}) => {
  const ranked = await fetchRankedModels(opts);
  if (ranked?.length) {
    setActiveModels(
      ranked.map((m) => m.id),
      ranked,
    );
    return ranked.map((m) => m.id);
  }
  return getModels();
};

export const makeApiRequest = async (
  messages: ChatMessage[],
  modelIndex: number,
  {
    maxRetries = 2,
    signal,
    temperature = 0.7,
    models,
  }: {
    maxRetries?: number;
    signal?: AbortSignal;
    temperature?: number;
    models?: string[];
  } = {},
): Promise<ApiRequestResult> => {
  const list = models && models.length ? models : getModels();
  const modelId = list[modelIndex];
  if (!modelId) {
    return { success: false, error: `No model configured at index ${modelIndex}` };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId, messages, temperature, stream: true }),
        signal,
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
      const err = error as Error;
      if (err.name === 'AbortError') {
        return { success: false, error: 'Request cancelled', aborted: true, modelId };
      }
      if (attempt === maxRetries) {
        return { success: false, error: err.message, modelId };
      }
      await sleep(2 ** attempt * 1000);
    }
  }

  return { success: false, error: 'Request failed', modelId };
};

export const processStream = async (
  response: Response,
  onChunk: (text: string) => void,
): Promise<{ received: boolean }> => {
  if (!response.body) {
    throw new Error('Response has no readable body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let received = false;

  const handleLine = (rawLine: string) => {
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
      buffer = lines.pop() ?? '';
      for (const line of lines) handleLine(line);
    }
    buffer += decoder.decode();
    if (buffer) handleLine(buffer);
  } finally {
    reader.releaseLock();
  }

  return { received };
};
