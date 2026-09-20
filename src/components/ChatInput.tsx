import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  type ChatAttachment,
  loadAttachment,
  revokeAttachmentPreviews,
} from '../lib/attachments';

type Props = {
  disabled?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
  onSend: (text: string, attachments: ChatAttachment[], forceWebSearch: boolean) => void;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function ChatInput({ disabled, isGenerating, onStop, onSend }: Props) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [forceWebSearch, setForceWebSearch] = useState(false);
  const [speechSupported] = useState(() => Boolean(getSpeechRecognitionCtor()));
  const imageRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseValueRef = useRef('');

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

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    if (listening) stopListening();
    const text = value.trim();
    const pending = attachments;
    onSend(text, pending, forceWebSearch);
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

  const stopListening = () => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  };

  const toggleListening = () => {
    if (!speechSupported || disabled) return;

    if (listening) {
      stopListening();
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    baseValueRef.current = value;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalChunk += transcript;
        else interim += transcript;
      }
      if (finalChunk) {
        const sep = baseValueRef.current && !baseValueRef.current.endsWith(' ') ? ' ' : '';
        baseValueRef.current = `${baseValueRef.current}${sep}${finalChunk.trim()}`;
      }
      const interimText = interim.trim();
      const next =
        interimText.length > 0
          ? `${baseValueRef.current}${baseValueRef.current && !baseValueRef.current.endsWith(' ') ? ' ' : ''}${interimText}`
          : baseValueRef.current;
      setValue(next);
    };

    recognition.onerror = (event) => {
      const err = event.error || '';
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setAttachError('Microphone permission denied. Allow mic access to use voice input.');
      } else if (err && err !== 'aborted' && err !== 'no-speech') {
        setAttachError('Voice input failed. Try again.');
      }
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      setValue(baseValueRef.current);
    };

    try {
      recognition.start();
      setListening(true);
      setAttachError(null);
    } catch {
      setAttachError('Could not start voice input.');
      setListening(false);
      recognitionRef.current = null;
    }
  };

  const micTitle = !speechSupported
    ? 'Voice input is not supported in this browser'
    : listening
      ? 'Stop listening'
      : 'Start voice input';

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

        <button
          type="button"
          className={`web-search-btn${forceWebSearch ? ' web-search-btn--active' : ''}`}
          aria-label={forceWebSearch ? 'Web search on' : 'Turn on web search'}
          aria-pressed={forceWebSearch}
          title={forceWebSearch ? 'Web search on' : 'Search the web for this message'}
          disabled={disabled}
          onClick={() => setForceWebSearch((enabled) => !enabled)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
            <path d="M4 11h14M11 4a11 11 0 0 1 0 14M11 4a11 11 0 0 0 0 14" />
          </svg>
          <span className="web-search-label">Web</span>
        </button>

        <textarea
          ref={composerRef}
          id="chat-input"
          rows={1}
          placeholder={listening ? 'Listening…' : 'Ask me anything...'}
          aria-label="Type your message"
          autoFocus
          disabled={disabled}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />

        <button
          type="button"
          className={`mic-btn${listening ? ' mic-btn--listening' : ''}`}
          aria-label={micTitle}
          aria-pressed={listening}
          title={micTitle}
          disabled={disabled || !speechSupported}
          onClick={toggleListening}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          {listening && <span className="mic-listening-label">Listening…</span>}
        </button>

        {isGenerating ? (
          <button id="stop" type="button" aria-label="Stop generating" onClick={onStop}>
            <span className="stop-icon" aria-hidden="true" />
            <span>Stop</span>
          </button>
        ) : (
          <button id="send" type="submit" aria-label="Send message" disabled={!canSend}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span>Send</span>
          </button>
        )}
      </form>
    </div>
  );
}
