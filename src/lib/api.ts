import { CHAT_ENDPOINT, MODELS_ENDPOINT, getModels } from './config';

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

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type ApiRequestResult =
  | { success: true; response: Response; modelId: string }
  | {
      success: false;
      error: string;
      status?: number;
      modelId?: string;
      aborted?: boolean;
    };

export const fetchRankedModels = async (): Promise<string[] | null> => {
  try {
    const response = await fetch(MODELS_ENDPOINT, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const ids = Array.isArray(data?.models) ? data.models.map((m: { id: string }) => m.id) : [];
    return ids.length ? ids : null;
  } catch (error) {
    console.warn('Model availability check failed:', (error as Error).message);
    return null;
  }
};

export const makeApiRequest = async (
  messages: ChatMessage[],
  modelIndex: number,
  { maxRetries = 2, signal, temperature = 0.7 }: {
    maxRetries?: number;
    signal?: AbortSignal;
    temperature?: number;
  } = {},
): Promise<ApiRequestResult> => {
  const modelId = getModels()[modelIndex];
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
