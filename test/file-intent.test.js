import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requestsHtmlFile } from '../src/lib/fileIntent.ts';

describe('HTML file intent', () => {
  it('detects explicit requests for an HTML file', () => {
    for (const text of [
      'Give me an HTML file',
      'Please create an HTML document',
      'Export this as an .html file',
      'Can you send the file in HTML?',
    ]) {
      assert.equal(requestsHtmlFile(text), true, text);
    }
  });

  it('does not expose file output for ordinary chat or code discussion', () => {
    for (const text of [
      'Hello',
      'Explain HTML forms',
      'Show me an HTML snippet',
      'Write this in markdown',
      'What does an HTML file contain?',
    ]) {
      assert.equal(requestsHtmlFile(text), false, text);
    }
  });
});
