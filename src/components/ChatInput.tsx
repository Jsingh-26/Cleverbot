import { FormEvent, useEffect, useRef, useState } from 'react';
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
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled;

  useEffect(() => {
    if (!attachMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!attachMenuRef.current?.contains(e.target as Node)) setAttachMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAttachMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [attachMenuOpen]);



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
    if (imageRef.current) imageRef.current.value = '';
    if (textRef.current) textRef.current.value = '';
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
          ref={imageRef}
          type="file"
          className="visually-hidden"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={(e) => void onPickFiles(e.target.files)}
        />
        <input
          ref={textRef}
          type="file"
          className="visually-hidden"
          accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
          multiple
          onChange={(e) => void onPickFiles(e.target.files)}
        />

        <div className="attach-menu" ref={attachMenuRef}>
          <button
            type="button"
            className={`attach-btn${attachMenuOpen ? ' attach-btn--open' : ''}`}
            aria-label="Attach a file"
            aria-expanded={attachMenuOpen}
            aria-haspopup="menu"
            disabled={disabled}
            onClick={() => setAttachMenuOpen((v) => !v)}
            title="Attach a file"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {attachMenuOpen && (
            <div className="attach-menu-panel" role="menu" aria-label="Attachment options">
              <button
                type="button"
                role="menuitem"
                className="attach-menu-item"
                onClick={() => {
                  setAttachMenuOpen(false);
                  imageRef.current?.click();
                }}
              >
                Attach image
              </button>
              <button
                type="button"
                role="menuitem"
                className="attach-menu-item"
                onClick={() => {
                  setAttachMenuOpen(false);
                  textRef.current?.click();
                }}
              >
                Attach text file
              </button>
            </div>
          )}
        </div>

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
