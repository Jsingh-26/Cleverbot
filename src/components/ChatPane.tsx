import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import {
  detectTaskHint,
  makeApiRequest,
  processStream,
  refreshSessionModels,
  type ChatMessage,
} from '../lib/api';
import {
  buildApiContent,
  buildPersistContent,
  revokeAttachmentPreviews,
  type ChatAttachment,
} from '../lib/attachments';
import { useVoiceMode } from '../hooks/useVoiceMode';
import { ChatInput } from './ChatInput';
import { HeaderAuth } from './HeaderAuth';
import { MessageBubble, ThinkingIndicator, type LocalMessage } from './MessageBubble';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../hooks/useTheme';

const MAX_HISTORY_MESSAGES = 24;

type Props = {
  activeThreadId: Id<'threads'> | null;
  onThreadCreated: (id: Id<'threads'>) => void;
  onRequestLogin: () => void;
  onNewChat: () => void;
};

export function ChatPane({ activeThreadId, onThreadCreated, onRequestLogin, onNewChat }: Props) {
  const { isAuthenticated } = useConvexAuth();
  const { resolved, toggleTheme } = useTheme();
  const createThread = useMutation(api.threads.createThread);
  const appendMessage = useMutation(api.messages.appendMessage);

  const remoteMessages = useQuery(
    api.messages.listMessages,
    isAuthenticated && activeThreadId ? { threadId: activeThreadId } : 'skip',
  );

  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [thinking, setThinking] = useState(false);
  const displayRef = useRef<HTMLDivElement>(null);
  const persistedAssistantIds = useRef(new Set<string>());

  const displayMessages: LocalMessage[] = useMemo(() => {
    if (!isAuthenticated || !activeThreadId) {
      return localMessages;
    }
    const remote = (remoteMessages ?? []).map((m) => ({
      id: m._id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      modelId: m.modelId,
    }));
    const remoteIds = new Set(remote.map((m) => m.content + m.role));
    const pending = localMessages.filter((m) => {
      if (m.role === 'error') return true;
      if (m.streaming) return true;
      return !remoteIds.has(m.content + m.role);
    });
    return [...remote, ...pending];
  }, [isAuthenticated, activeThreadId, remoteMessages, localMessages]);

  useEffect(() => {
    const el = displayRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayMessages, thinking]);

  const buildConversation = useCallback(
    (msgs: LocalMessage[], latestApiContent?: ChatMessage['content']): ChatMessage[] => {
      const base: ChatMessage[] = msgs
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        }));
      if (latestApiContent !== undefined && base.length > 0) {
        for (let i = base.length - 1; i >= 0; i--) {
          if (base[i].role === 'user') {
            base[i] = { role: 'user', content: latestApiContent };
            break;
          }
        }
      }
      return base;
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string, attachments: ChatAttachment[] = []): Promise<string | null> => {
      if (isProcessing) return null;
      if (!text.trim() && attachments.length === 0) return null;

      setIsProcessing(true);
      setThinking(true);

      const persistContent = buildPersistContent(text, attachments);
      const apiContent = buildApiContent(text, attachments);
      const hasImages = attachments.some((a) => a.kind === 'image');

      const userMsg: LocalMessage = {
        id: `local-user-${Date.now()}`,
        role: 'user',
        content: persistContent,
      };

      let workingThreadId = activeThreadId;
      let assistantReply: string | null = null;

      try {
        setLocalMessages((prev) => [...prev, userMsg]);

        if (isAuthenticated) {
          if (!workingThreadId) {
            workingThreadId = await createThread({});
            onThreadCreated(workingThreadId);
          }
          await appendMessage({
            threadId: workingThreadId,
            role: 'user',
            content: persistContent,
          });
        }

        const historyForApi = buildConversation(
          isAuthenticated && activeThreadId && remoteMessages
            ? [
                ...remoteMessages.map((m) => ({
                  id: m._id,
                  role: m.role as 'user' | 'assistant',
                  content: m.content,
                })),
                ...localMessages,
                userMsg,
              ]
            : [...localMessages, userMsg],
          apiContent,
        );

        const task = detectTaskHint(historyForApi, { hasImages });
        const models = await refreshSessionModels({ task });

        let succeeded = false;

        const attempts: Array<{ auto: boolean; index: number; label: string }> = [
          { auto: true, index: 0, label: 'auto' },
          ...models.slice(0, 5).map((id, index) => ({
            auto: false,
            index,
            label: id,
          })),
        ];

        for (const attempt of attempts) {
          const result = await makeApiRequest(historyForApi, attempt.index, {
            models,
            auto: attempt.auto,
          });
          if (!result.success) {
            console.warn(`Model ${attempt.label} failed:`, result.error);
            continue;
          }

          setThinking(false);
          const botId = `local-bot-${Date.now()}`;
          let usedModelId = result.modelId;
          setLocalMessages((prev) => [
            ...prev,
            {
              id: botId,
              role: 'assistant',
              content: '',
              modelId: usedModelId,
              streaming: true,
            },
          ]);

          let rawResponse = '';
          try {
            const { received, modelId: streamedModelId } = await processStream(
              result.response,
              (chunk) => {
                rawResponse += chunk;
                setLocalMessages((prev) =>
                  prev.map((m) => (m.id === botId ? { ...m, content: rawResponse } : m)),
                );
              },
              {
                onModelId: (id) => {
                  usedModelId = id;
                  setLocalMessages((prev) =>
                    prev.map((m) => (m.id === botId ? { ...m, modelId: id } : m)),
                  );
                },
              },
            );

            if (streamedModelId) usedModelId = streamedModelId;

            if (!received || !rawResponse.trim()) {
              throw new Error('Model returned an empty response');
            }

            setLocalMessages((prev) =>
              prev.map((m) =>
                m.id === botId
                  ? { ...m, content: rawResponse, streaming: false, modelId: usedModelId }
                  : m,
              ),
            );

            if (isAuthenticated && workingThreadId) {
              await appendMessage({
                threadId: workingThreadId,
                role: 'assistant',
                content: rawResponse,
                modelId: usedModelId,
              });
              persistedAssistantIds.current.add(botId);
              setLocalMessages((prev) =>
                prev.filter((m) => m.id !== userMsg.id && m.id !== botId),
              );
            }

            assistantReply = rawResponse;
            succeeded = true;
            break;
          } catch (streamError) {
            console.warn(`Stream from ${attempt.label} failed:`, (streamError as Error).message);
            setLocalMessages((prev) => prev.filter((m) => m.id !== botId));
          }
        }

        if (!succeeded) {
          setThinking(false);
          setLocalMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: 'error',
              content:
                'Error: Unable to get a response from any available model. Please try again later.',
            },
          ]);
        }
      } catch (error) {
        console.error('Unexpected error in sendMessage:', error);
        setThinking(false);
        setLocalMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'error',
            content: 'An unexpected error occurred. Please try again.',
          },
        ]);
      } finally {
        revokeAttachmentPreviews(attachments);
        setIsProcessing(false);
        setThinking(false);
      }

      return assistantReply;
    },
    [
      activeThreadId,
      appendMessage,
      buildConversation,
      createThread,
      isAuthenticated,
      isProcessing,
      localMessages,
      onThreadCreated,
      remoteMessages,
    ],
  );

  const onVoiceAutoSend = useCallback(
    (utterance: string) => sendMessage(utterance, []),
    [sendMessage],
  );

  const voice = useVoiceMode({ onAutoSend: onVoiceAutoSend });

  const voiceTitle = !voice.supported
    ? 'Voice mode is not supported in this browser'
    : voice.active
      ? 'Stop voice mode'
      : 'Start voice mode';

  const voicePhaseLabel =
    voice.phase === 'listening'
      ? 'Listening'
      : voice.phase === 'thinking'
        ? 'Thinking'
        : voice.phase === 'speaking'
          ? 'Speaking'
          : null;

  return (
    <div className={`chat-pane${voice.active ? ' chat-pane--voice' : ''}`}>
      <header className="header" role="banner">
        <div className="header-leading">
          {isAuthenticated ? (
            <button type="button" className="header-new-chat-btn" onClick={onNewChat}>
              New chat
            </button>
          ) : (
            <div className="header-brand logo" aria-hidden="true">
              Cleverbot
            </div>
          )}
        </div>
        <div className="header-actions">
          <button
            type="button"
            className={`voice-mode-btn${voice.active ? ' voice-mode-btn--active' : ''}`}
            aria-label={voiceTitle}
            aria-pressed={voice.active}
            title={voiceTitle}
            disabled={!voice.supported}
            onClick={voice.toggle}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <span className="voice-mode-btn-label">Voice</span>
            {voice.active && voicePhaseLabel && (
              <span className="voice-mode-phase" aria-live="polite">
                {voicePhaseLabel}
              </span>
            )}
          </button>
          {voice.active && (
            <button
              type="button"
              className="voice-stop-btn"
              onClick={voice.exit}
              title="Stop voice mode (Esc)"
              aria-label="Stop voice mode"
            >
              Stop
            </button>
          )}
          <HeaderAuth onRequestLogin={onRequestLogin} />
          <ThemeToggle resolved={resolved} onToggle={toggleTheme} />
        </div>
      </header>

      <div id="chat-display" role="log" aria-label="Chat messages" ref={displayRef}>
        <div className="message-container" role="list">
          {displayMessages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {thinking && <ThinkingIndicator />}
        </div>
      </div>

      {voice.error && (
        <p className="voice-mode-error" role="alert">
          {voice.error}
        </p>
      )}

      <ChatInput
        disabled={isProcessing}
        onSend={(text, attachments) => void sendMessage(text, attachments)}
      />
    </div>
  );
}
