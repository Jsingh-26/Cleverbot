import { useEffect, useRef } from 'react';
import { formatModelName } from '../lib/config';
import { highlightCodeBlocks, safeMarkdown } from '../lib/markdown';

export type LocalMessage = {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  modelId?: string | null;
  streaming?: boolean;
};

type Props = {
  message: LocalMessage;
};

export function MessageBubble({ message }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const type = message.role === 'assistant' ? 'bot' : message.role;

  useEffect(() => {
    const el = contentRef.current;
    if (!el || message.role !== 'assistant') return;

    if (message.role === 'assistant') {
      const html = safeMarkdown(message.content);
      if (html === null) {
        el.textContent = message.content;
      } else {
        el.innerHTML = html;
        if (!message.streaming) {
          highlightCodeBlocks(el);
        }
      }
    }
  }, [message.content, message.role, message.streaming]);

  return (
    <div className={`message-wrapper ${type}`}>
      <div className="message-content">
        <div className={`avatar ${type}-avatar`}>
          {type === 'user' ? 'U' : type === 'error' ? '!' : 'C'}
        </div>
        <div className="message" ref={contentRef}>
          {message.role !== 'assistant' ? message.content : null}
        </div>
      </div>
      {message.role === 'assistant' && message.modelId && !message.streaming && (
        <div className="model-info">
          <div className="model-name" role="status">
            Answered with {formatModelName(message.modelId)}
          </div>
        </div>
      )}
    </div>
  );
}

export function ThinkingIndicator() {
  return (
    <div className="thinking" role="status" aria-live="polite">
      <span>Thinking</span>
      <div className="dots">
        <div className="dot" />
        <div className="dot" />
        <div className="dot" />
      </div>
    </div>
  );
}
