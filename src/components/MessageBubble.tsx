import { useEffect, useRef } from 'react';
import { formatModelName } from '../lib/config';
import { downloadMessageAsHtml } from '../lib/exportMessage';
import { highlightCodeBlocks, safeMarkdown } from '../lib/markdown';

export type LocalMessage = {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  modelId?: string | null;
  streaming?: boolean;
  requestedFile?: 'html';
};

type Props = {
  message: LocalMessage;
};

export function MessageBubble({ message }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const type = message.role === 'assistant' ? 'bot' : message.role;
  const showHtmlFile =
    message.role === 'assistant' &&
    !message.streaming &&
    message.requestedFile === 'html' &&
    message.content.trim().length > 0;

  useEffect(() => {
    const el = contentRef.current;
    if (!el || message.role !== 'assistant') return;

    const html = safeMarkdown(message.content);
    if (html === null) {
      el.textContent = message.content;
    } else {
      el.innerHTML = html;
      if (!message.streaming) {
        highlightCodeBlocks(el);
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
      {message.role === 'assistant' && !message.streaming && (
        <div className="message-meta">
          {message.modelId && (
            <div className="model-info">
              <div className="model-name" role="status">
                Answered with {formatModelName(message.modelId)}
              </div>
            </div>
          )}
          {showHtmlFile && (
            <div className="message-actions" role="group" aria-label="Requested file">
              <button
                type="button"
                className="msg-dl-btn"
                title="Download requested HTML file"
                aria-label="Download requested HTML file"
                onClick={() => downloadMessageAsHtml(message.content)}
              >
                <span className="msg-dl-icon" aria-hidden="true">
                  HTML
                </span>
                <span className="msg-dl-label">Download file</span>
              </button>
            </div>
          )}
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
