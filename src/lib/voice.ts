/**
 * Voice-mode helpers: speech support detection + light TTS text cleanup.
 */

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor());
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

export function isVoiceModeSupported(): boolean {
  return isSpeechRecognitionSupported() && isSpeechSynthesisSupported();
}

/**
 * Light cleanup so TTS does not read markdown chrome aloud.
 * - fenced code blocks → "code block"
 * - inline `code` → bare text
 * - headings / emphasis markers stripped
 * - long URLs shortened
 */
export function stripForSpeech(raw: string): string {
  let text = raw;

  // Fenced code blocks (keep a spoken placeholder)
  text = text.replace(/```[^\n`]*\n[\s\S]*?```/g, ' code block ');

  // Inline code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Images ![alt](url) → alt
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Links [label](url) → label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Bare URLs → shortened host
  text = text.replace(/https?:\/\/[^\s)]+/gi, (url) => {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return 'link';
    }
  });

  // Headings / list markers / blockquotes
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/^\s*>\s?/gm, '');

  // Bold / italic / strikethrough markers
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/** Speak text with speechSynthesis; resolves when utterence ends or is cancelled. */
export function speakText(text: string, opts?: { lang?: string; rate?: number }): Promise<'ended' | 'cancelled' | 'empty'> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve('empty');
  const cleaned = stripForSpeech(text);
  if (!cleaned) return Promise.resolve('empty');

  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = opts?.lang || navigator.language || 'en-US';
    if (opts?.rate != null) utter.rate = opts.rate;
    let settled = false;
    const finish = (reason: 'ended' | 'cancelled') => {
      if (settled) return;
      settled = true;
      resolve(reason);
    };
    utter.onend = () => finish('ended');
    utter.onerror = () => finish('cancelled');
    window.speechSynthesis.speak(utter);
  });
}

export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
