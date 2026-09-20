import { FormEvent, useRef, useState } from 'react';
import {
  type ChatAttachment,
  loadAttachment,
  revokeAttachmentPreviews,
} from '../lib/attachments';

type Props = {
  disabled?: boolean;
  onSend: (text: string, attachments: ChatAttachment[]) => void;
};

export function ChatInput({ disabled, onSend }: Props) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    const text = value.trim();
    const pending = attachments;
    onSend(text, pending);
    setValue('');
    setAttachments([]);
    setAttachError(null);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const victim = prev.find((a) => a.id === id);
      if (victim) revokeAttachmentPreviews([victim]);
      return prev.filter((a) => a.id !== id);
    });
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setAttachError(null);
    const next: ChatAttachment[] = [];
    for (const file of Array.from(files)) {
      try {
        next.push(await loadAttachment(file));
      } catch (err) {
        setAttachError(err instanceof Error ? err.message : 'Could not add file');
      }
    }
    if (next.length) setAttachments((prev) => [...prev, ...next].slice(0, 6));
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="input-section" role="form" aria-label="Message input">
      {attachments.length > 0 && (
        <ul className="attach-chips" aria-label="Attachments">
          {attachments.map((a) => (
            <li key={a.id} className={`attach-chip attach-chip--${a.kind}`}>
              {a.kind === 'image' && a.previewUrl ? (
                <img src={a.previewUrl} alt="" className="attach-thumb" />
              ) : (
                <span className="attach-file-icon" aria-hidden="true">
                  📄
                </span>
              )}
              <span className="attach-name" title={a.name}>
                {a.name}
              </span>
              <button
                type="button"
                className="attach-remove"
                aria-label={`Remove ${a.name}`}
                onClick={() => removeAttachment(a.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {attachError && (
        <p className="attach-error" role="alert">
          {attachError}
        </p>
      )}
      <form className="input-group" onSubmit={submit}>
        <input
          ref={fileRef}
          type="file"
          className="visually-hidden"
          accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
          multiple
          onChange={(e) => void onPickFiles(e.target.files)}
        />
        <button
          type="button"
          className="attach-btn"
          aria-label="Attach file"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          title="Attach image or text file"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 01-7.78-7.78l8.49-8.49a3.5 3.5 0 014.95 4.95l-8.5 8.49a1.5 1.5 0 01-2.12-2.12l7.79-7.79" />
          </svg>
        </button>
        <input
          type="text"
          id="chat-input"
          placeholder="Ask me anything..."
          aria-label="Type your message"
          autoFocus
          disabled={disabled}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button id="send" type="submit" aria-label="Send message" disabled={!canSend}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
