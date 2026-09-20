/**
 * Pure helpers for exporting assistant messages as Markdown / HTML downloads.
 */

const FENCE_RE = /```([^\n`]*)\n([\s\S]*?)```/g;

/** Prefer the first fenced block whose language matches one of `langs` (case-insensitive). */
export function extractFencedBlock(content: string, langs: string[]): string | null {
  const wanted = new Set(langs.map((l) => l.toLowerCase()));
  FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCE_RE.exec(content)) !== null) {
    const lang = (match[1] || '').trim().split(/\s+/)[0].toLowerCase();
    if (wanted.has(lang)) {
      return match[2].replace(/\s+$/, '');
    }
  }
  return null;
}

/** Strip UI chrome like "Answered with …" if it somehow landed in the body. */
export function stripAnswerChrome(content: string): string {
  return content
    .replace(/^\s*Answered with[^\n]*\n+/i, '')
    .replace(/\n+\s*Answered with[^\n]*\s*$/i, '')
    .trimEnd();
}

export function prepareMarkdownBody(content: string): string {
  const fenced = extractFencedBlock(content, ['markdown', 'md']);
  const body = fenced ?? content;
  return stripAnswerChrome(body).replace(/^\uFEFF/, '');
}

/** True when the string looks like a full HTML document. */
export function looksLikeHtmlDocument(text: string): boolean {
  const trimmed = text.trimStart();
  return /^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
}

/**
 * Body source for HTML download (before wrapping / sanitizing):
 * 1. fenced ```html
 * 2. full HTML document in the message
 * 3. otherwise null → caller should render markdown
 */
export function prepareHtmlSource(content: string): { kind: 'html'; html: string } | { kind: 'markdown'; markdown: string } {
  const fencedHtml = extractFencedBlock(content, ['html', 'htm']);
  if (fencedHtml !== null) {
    return { kind: 'html', html: fencedHtml };
  }
  const cleaned = stripAnswerChrome(content);
  if (looksLikeHtmlDocument(cleaned)) {
    return { kind: 'html', html: cleaned };
  }
  return { kind: 'markdown', markdown: cleaned };
}

export function wrapHtmlDocument(bodyHtml: string, title = 'Cleverbot export'): string {
  const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    line-height: 1.6;
    max-width: 48rem;
    margin: 2rem auto;
    padding: 0 1.25rem;
    color: #1f2937;
    background: #fff;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e5e7eb; background: #111827; }
  }
  pre {
    overflow-x: auto;
    padding: 0.85rem 1rem;
    border-radius: 0.5rem;
    background: #f3f4f6;
  }
  @media (prefers-color-scheme: dark) {
    pre { background: #1f2937; }
  }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }
  pre code { font-size: 0.875em; }
  a { color: #2563eb; }
  img { max-width: 100%; height: auto; }
  h1, h2, h3 { line-height: 1.25; }
  blockquote {
    margin: 0;
    padding-left: 1rem;
    border-left: 3px solid #d1d5db;
    color: #6b7280;
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

/** Local timestamp filename: cleverbot-YYYYMMDD-HHMM.ext */
export function exportFilename(ext: 'md' | 'html', date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `cleverbot-${y}${mo}${d}-${h}${mi}.${ext}`;
}

/** Trigger a browser file download via Blob + object URL. */
export function triggerBrowserDownload(filename: string, mime: string, body: string): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the browser has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
