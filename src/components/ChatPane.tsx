import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { makeApiRequest, processStream, type ChatMessage } from '../lib/api';
import { getModels } from '../lib/config';
import { ChatInput } from './ChatInput';
import { MessageBubble, ThinkingIndicator, type LocalMessage } from './MessageBubble';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../hooks/useTheme';

const MAX_HISTORY_MESSAGES = 24;

type Props = {
  activeThreadId: Id<'threads'> | null;
  onThreadCreated: (id: Id<'threads'>) => void;
};

export function ChatPane({ activeThreadId, onThreadCreated }: Props) {
  const { isAuthenticated } = useConvexAuth();
  const { preference, resolved, setTheme } = useTheme();
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
    // Keep in-flight local drafts that are not yet reflected remotely.
    const remoteIds = new Set(remote.map((m) => m.content + m.role));
    const pending = localMessages.filter((m) => {
      if (m.role === 'error') return true;
      if (m.streaming) return true;
      // Drop duplicates once remote caught up (match by role+content).
      return !remoteIds.has(m.content + m.role);
    });
    return [...remote, ...pending];
  }, [isAuthenticated, activeThreadId, remoteMessages, localMessages]);

  useEffect(() => {
    const el = displayRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayMessages, thinking]);

  const buildConversation = useCallback(
    (msgs: LocalMessage[]): ChatMessage[] =>
      msgs
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
    [],
  );

  const sendMessage = async (text: string) => {
    if (!text || isProcessing) return;
    setIsProcessing(true);
    setThinking(true);

    const userMsg: LocalMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    let workingThreadId = activeThreadId;

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
          content: text,
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
      );

      const models = getModels();
      let succeeded = false;

      for (let i = 0; i < models.length; i++) {
        const result = await makeApiRequest(historyForApi, i);
        if (!result.success) {
          console.warn(`Model ${models[i]} failed:`, result.error);
          continue;
        }

        setThinking(false);
        const botId = `local-bot-${Date.now()}`;
        setLocalMessages((prev) => [
          ...prev,
          {
            id: botId,
            role: 'assistant',
            content: '',
            modelId: result.modelId,
            streaming: true,
          },
        ]);

        let rawResponse = '';
        try {
          const { received } = await processStream(result.response, (chunk) => {
            rawResponse += chunk;
            setLocalMessages((prev) =>
              prev.map((m) => (m.id === botId ? { ...m, content: rawResponse } : m)),
            );
          });

          if (!received || !rawResponse.trim()) {
            throw new Error('Model returned an empty response');
          }

          setLocalMessages((prev) =>
            prev.map((m) =>
              m.id === botId ? { ...m, content: rawResponse, streaming: false } : m,
            ),
          );

          if (isAuthenticated && workingThreadId) {
            await appendMessage({
              threadId: workingThreadId,
              role: 'assistant',
              content: rawResponse,
              modelId: result.modelId,
            });
            persistedAssistantIds.current.add(botId);
            // Once remote query refreshes, pending filter drops these.
            setLocalMessages((prev) =>
              prev.filter((m) => m.id !== userMsg.id && m.id !== botId),
            );
          }

          succeeded = true;
          break;
        } catch (streamError) {
          console.warn(`Stream from ${models[i]} failed:`, (streamError as Error).message);
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
      setIsProcessing(false);
      setThinking(false);
    }
  };

  return (
    <div className="chat-pane">
      <header className="header" role="banner">
        <div className="header-spacer" />
        <ThemeToggle preference={preference} resolved={resolved} onChange={setTheme} />
      </header>

      <div id="chat-display" role="log" aria-label="Chat messages" ref={displayRef}>
        <div className="message-container" role="list">
          {displayMessages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {thinking && <ThinkingIndicator />}
        </div>
      </div>

      <ChatInput disabled={isProcessing} onSend={(text) => void sendMessage(text)} />
    </div>
  );
}
