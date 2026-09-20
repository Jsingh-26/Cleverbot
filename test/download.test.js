import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFencedBlock,
  stripAnswerChrome,
  prepareMarkdownBody,
  prepareHtmlSource,
  looksLikeHtmlDocument,
  wrapHtmlDocument,
  exportFilename,
} from '../src/lib/download.ts';

describe('download helpers', () => {
  it('extracts fenced html / markdown blocks by language', () => {
    const md = [
      'Here you go:',
      '',
      '```html',
      '<h1>Hi</h1>',
      '```',
      '',
      '```markdown',
      '# Title',
      '',
      'Body',
      '```',
    ].join('\n');

    assert.equal(extractFencedBlock(md, ['html']), '<h1>Hi</h1>');
    assert.equal(extractFencedBlock(md, ['markdown', 'md']), '# Title\n\nBody');
    assert.equal(extractFencedBlock(md, ['python']), null);
  });

  it('prefers md fence alias for markdown downloads', () => {
    const raw = 'Intro\n\n```md\nHello **world**\n```\n';
    assert.equal(prepareMarkdownBody(raw), 'Hello **world**');
  });

  it('strips Answered with chrome from bodies', () => {
    assert.equal(stripAnswerChrome('Hello\n\nAnswered with Gemma'), 'Hello');
    assert.equal(stripAnswerChrome('Answered with Foo\n\nHi'), 'Hi');
  });

  it('detects full HTML documents vs fragments', () => {
    assert.equal(looksLikeHtmlDocument('<!DOCTYPE html><html><body>x</body></html>'), true);
    assert.equal(looksLikeHtmlDocument('<html lang="en"><body>x</body></html>'), true);
    assert.equal(looksLikeHtmlDocument('<h1>fragment</h1>'), false);
  });

  it('prepareHtmlSource prefers fenced html, then documents, else markdown', () => {
    const fenced = prepareHtmlSource('```html\n<div>A</div>\n```');
    assert.deepEqual(fenced, { kind: 'html', html: '<div>A</div>' });

    const doc = prepareHtmlSource('<!DOCTYPE html><html><body>Z</body></html>');
    assert.equal(doc.kind, 'html');

    const md = prepareHtmlSource('Just **text**');
    assert.deepEqual(md, { kind: 'markdown', markdown: 'Just **text**' });
  });

  it('wraps fragments in a standalone Cleverbot export document', () => {
    const doc = wrapHtmlDocument('<p>Hello</p>');
    assert.match(doc, /<!DOCTYPE html>/i);
    assert.match(doc, /<title>Cleverbot export<\/title>/);
    assert.match(doc, /<p>Hello<\/p>/);
    assert.match(doc, /max-width:\s*48rem/);
  });

  it('builds cleverbot-YYYYMMDD-HHMM filenames', () => {
    const d = new Date(2026, 8, 20, 23, 48); // local Sep 20 2026 23:48
    assert.equal(exportFilename('md', d), 'cleverbot-20260920-2348.md');
    assert.equal(exportFilename('html', d), 'cleverbot-20260920-2348.html');
  });
});
