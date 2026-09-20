import type { ContentPart } from './api';

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const TEXT_MAX_BYTES = 200 * 1024;
export const TEXT_TRUNCATE_CHARS = 12_000;

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const TEXT_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/json',
]);
const TEXT_EXTS = new Set(['.txt', '.md', '.csv', '.json']);

export type ChatAttachment = {
  id: string;
  name: string;
  kind: 'image' | 'text';
  mime: string;
  size: number;
  /** data URL for images (sent to the API) */
  dataUrl?: string;
  /** object URL for local preview chips */
  previewUrl?: string;
  /** truncated file text for text attachments */
  textContent?: string;
};

export type AttachmentError = { name: string; message: string };

const extOf = (name: string) => {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
};

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const readAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsText(file);
  });

export const classifyFile = (file: File): 'image' | 'text' | null => {
  if (IMAGE_TYPES.has(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
    return 'image';
  }
  if (TEXT_TYPES.has(file.type) || TEXT_EXTS.has(extOf(file.name))) {
    return 'text';
  }
  return null;
};

export async function loadAttachment(file: File): Promise<ChatAttachment> {
  const kind = classifyFile(file);
  if (!kind) {
    throw new Error('Unsupported file type. Use png/jpeg/webp/gif or txt/md/csv/json.');
  }
  if (kind === 'image' && file.size > IMAGE_MAX_BYTES) {
    throw new Error('Image must be 5MB or smaller.');
  }
  if (kind === 'text' && file.size > TEXT_MAX_BYTES) {
    throw new Error('Text file must be 200KB or smaller.');
  }

  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const mime = file.type || (kind === 'image' ? 'image/png' : 'text/plain');

  if (kind === 'image') {
    const dataUrl = await readAsDataUrl(file);
    return {
      id,
      name: file.name,
      kind,
      mime,
      size: file.size,
      dataUrl,
      previewUrl: URL.createObjectURL(file),
    };
  }

  let text = await readAsText(file);
  if (text.length > TEXT_TRUNCATE_CHARS) {
    text = `${text.slice(0, TEXT_TRUNCATE_CHARS)}\n…[truncated]`;
  }
  return {
    id,
    name: file.name,
    kind,
    mime,
    size: file.size,
    textContent: text,
  };
}

/** Human-readable summary stored in Convex (no blobs). */
export function summarizeAttachments(attachments: ChatAttachment[]): string {
  if (!attachments.length) return '';
  const bits = attachments.map((a) =>
    a.kind === 'image' ? `[image: ${a.name}]` : `[file: ${a.name}]`,
  );
  return bits.join(' ');
}

/** Build API message content (string or multimodal parts) from text + attachments. */
export function buildApiContent(
  text: string,
  attachments: ChatAttachment[],
): string | ContentPart[] {
  const images = attachments.filter((a) => a.kind === 'image' && a.dataUrl);
  const texts = attachments.filter((a) => a.kind === 'text' && a.textContent);

  let body = text.trim();
  if (texts.length) {
    const fileBlocks = texts
      .map((a) => `--- File: ${a.name} ---\n${a.textContent}`)
      .join('\n\n');
    body = body ? `${body}\n\n${fileBlocks}` : fileBlocks;
  }

  if (!images.length) {
    return body || '(empty)';
  }

  const parts: ContentPart[] = [];
  if (body) parts.push({ type: 'text', text: body });
  for (const img of images) {
    parts.push({ type: 'image_url', image_url: { url: img.dataUrl! } });
  }
  if (!parts.some((p) => p.type === 'text')) {
    parts.unshift({ type: 'text', text: text.trim() || 'Please look at the attached image(s).' });
  }
  return parts;
}

/** Display / persist string for the user bubble + Convex. */
export function buildPersistContent(text: string, attachments: ChatAttachment[]): string {
  const summary = summarizeAttachments(attachments);
  const trimmed = text.trim();
  if (trimmed && summary) return `${trimmed}\n\n${summary}`;
  if (trimmed) return trimmed;
  return summary || '';
}

export function revokeAttachmentPreviews(attachments: ChatAttachment[]) {
  for (const a of attachments) {
    if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
  }
}
