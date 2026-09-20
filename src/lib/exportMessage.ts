/**
 * Browser-side message export (Markdown / HTML downloads).
 */
import DOMPurify from 'dompurify';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { safeMarkdown } from './markdown';
import {
  exportFilename,
  looksLikeHtmlDocument,
  prepareHtmlSource,
  triggerBrowserDownload,
  wrapHtmlDocument,
} from './download';

function sanitizeHtmlFragment(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function sanitizeHtmlDocument(html: string): string {
  const cleaned = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['link', 'style', 'meta', 'title'],
    ADD_ATTR: ['charset', 'content', 'http-equiv', 'name', 'viewport'],
  });
  // If purify collapsed to a fragment, wrap it.
  if (!looksLikeHtmlDocument(cleaned)) {
    return wrapHtmlDocument(sanitizeHtmlFragment(html));
  }
  return cleaned;
}

export function downloadMessageAsHtml(content: string): void {
  const source = prepareHtmlSource(content);
  let doc: string;

  if (source.kind === 'html') {
    if (looksLikeHtmlDocument(source.html)) {
      doc = sanitizeHtmlDocument(source.html);
    } else {
      doc = wrapHtmlDocument(sanitizeHtmlFragment(source.html));
    }
  } else {
    const rendered = safeMarkdown(source.markdown);
    const body =
      rendered ??
      `<pre>${source.markdown
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</pre>`;
    doc = wrapHtmlDocument(body);
  }

  const filename = exportFilename('html');
  if (Capacitor.isNativePlatform()) {
    void (async () => {
      const saved = await Filesystem.writeFile({
        path: filename,
        data: btoa(unescape(encodeURIComponent(doc))),
        directory: Directory.Cache,
      });
      await Share.share({ title: filename, url: saved.uri, dialogTitle: 'Save or share HTML file' });
    })();
    return;
  }
  triggerBrowserDownload(filename, 'text/html;charset=utf-8', doc);
}
