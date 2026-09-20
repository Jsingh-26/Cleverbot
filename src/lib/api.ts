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

export type TaskHint = 'vision' | 'code' | 'write' | 'chat';

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

/**
 * Lightweight client-side task hint (mirrors server detectTask).
 * Used to refresh the fallback/retry chain; primary send uses model:"auto".
 * Priority: vision > code > write > chat.
 */
export const detectTaskHint = (
  messages: ChatMessage[],
  opts: { hasImages?: boolean } = {},
): TaskHint => {
  if (opts.hasImages) return 'vision';

  let latestUser: ChatMessage | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') {
      latestUser = messages[i];
      break;
    }
  }
  if (!latestUser) return 'chat';

  const content = latestUser.content;
  let text = '';
  let hasImage = false;

  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (part?.type === 'image_url') hasImage = true;
      if (part?.type === 'text' && typeof part.text === 'string') {
        text += (text ? '\n' : '') + part.text;
      }
    }
  }

  if (hasImage) return 'vision';

  const lower = text.toLowerCase();
  const codeSignals =
    /```/.test(text)
    || /\b(function|def |class |import |from |const |let |var |async |await |console\.|printf|println|traceback|stack trace|compile|debug|refactor|typescript|javascript|python|golang|rustc|webpack|npm |pip |cargo |git diff|eslint|prettier)\b/i.test(text)
    || /\.(js|ts|tsx|jsx|py|go|rs|java|cpp|c|h|rb|php|cs|kt|swift|sql|sh|bash|yml|yaml|json|toml|mdx)\b/i.test(text)
    || /error:\s|exception:|at\s+\w+\.\w+\(/.test(text);

  if (codeSignals) return 'code';

  const writeSignals =
    /\b(essay|blog post|write (me )?(a|an|the)|draft (an? )?email|cover letter|poem|short story|creative writing|rewrite this|proofread|linkedin post|newsletter)\b/i.test(lower);

  if (writeSignals) return 'write';
  return 'chat';
};

/** Fetch live ranked free models. Pass task (or legacy hasImages) for ranking. */
export const fetchRankedModels = async (
  opts: { hasImages?: boolean; task?: TaskHint } = {},
): Promise<RankedModel[] | null> => {
  try {
    const task: TaskHint = opts.task ?? (opts.hasImages ? 'vision' : 'chat');
    const qs =
      task === 'chat'
        ? ''
        : task === 'vision' && opts.hasImages && !opts.task
          ? '?images=1'
          : `?task=${encodeURIComponent(task)}`;
    const url = `${MODELS_ENDPOINT}${qs}`;
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
export const refreshSessionModels = async (
  opts: { hasImages?: boolean; task?: TaskHint } = {},
) => {
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

const resolveModelIdFromResponse = (response: Response, fallback?: string) => {
  const header = response.headers.get('X-Model-Id') || response.headers.get('x-model-id');
  if (header && header.trim()) return header.trim();
  return fallback || 'auto';
};

export const makeApiRequest = async (
  messages: ChatMessage[],
  modelIndex: number,
  {
    maxRetries = 2,
    signal,
    temperature = 0.7,
    models,
    /** Prefer server-side auto routing (model omitted / "auto"). */
    auto = false,
    forceWebSearch = false,
  }: {
    maxRetries?: number;
    signal?: AbortSignal;
    temperature?: number;
    models?: string[];
    auto?: boolean;
    forceWebSearch?: boolean;
  } = {},
): Promise<ApiRequestResult> => {
  const list = models && models.length ? models : getModels();
  const explicitId = auto ? undefined : list[modelIndex];
  if (!auto && !explicitId) {
    return { success: false, error: `No model configured at index ${modelIndex}` };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const payload: Record<string, unknown> = {
        messages,
        temperature,
        stream: true,
        forceWebSearch,
      };
      payload.model = auto ? 'auto' : explicitId;

      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        const error = await readErrorMessage(response);
        if (isRetryable(response.status) && attempt < maxRetries) {
          await sleep(2 ** attempt * 1000);
          continue;
        }
        return {
          success: false,
          error,
          status: response.status,
          modelId: resolveModelIdFromResponse(response, explicitId),
        };
      }

      return {
        success: true,
        response,
        modelId: resolveModelIdFromResponse(response, explicitId),
      };
    } catch (error) {
      const err = error as Error;
      if (err.name === 'AbortError') {
        return {
          success: false,
          error: 'Request cancelled',
          aborted: true,
          modelId: explicitId,
        };
      }
      if (attempt === maxRetries) {
        return { success: false, error: err.message, modelId: explicitId };
      }
      await sleep(2 ** attempt * 1000);
    }
  }

  return { success: false, error: 'Request failed', modelId: explicitId };
};

export const processStream = async (
  response: Response,
  onChunk: (text: string) => void,
  opts?: { onModelId?: (id: string) => void; signal?: AbortSignal },
): Promise<{ received: boolean; modelId?: string }> => {
  if (!response.body) {
    throw new Error('Response has no readable body');
  }

  const reader = response.body.getReader();
  const onAbort = () => void reader.cancel('Request cancelled');
  opts?.signal?.addEventListener('abort', onAbort, { once: true });
  const decoder = new TextDecoder();
  let buffer = '';
  let received = false;
  let modelId: string | undefined =
    response.headers.get('X-Model-Id') || response.headers.get('x-model-id') || undefined;

  const handleLine = (rawLine: string) => {
    const line = rawLine.trimEnd();
    // SSE comment announcing chosen model: ": model vendor/id:free"
    if (line.startsWith(':')) {
      const meta = line.slice(1).trim();
      const match = /^model\s+(\S+)/i.exec(meta);
      if (match?.[1]) {
        modelId = match[1];
        opts?.onModelId?.(modelId);
      }
      return;
    }
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice(5).trim();
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
    opts?.signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }

  return { received, modelId };
};
