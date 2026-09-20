import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stripForSpeech } from '../src/lib/voice.ts';

describe('stripForSpeech', () => {
  it('replaces fenced code with a spoken placeholder', () => {
    const out = stripForSpeech('Before\n```js\nconsole.log(1)\n```\nAfter');
    assert.match(out, /code block/i);
    assert.doesNotMatch(out, /console\.log/);
    assert.match(out, /Before/);
    assert.match(out, /After/);
  });

  it('strips markdown emphasis and headings', () => {
    const out = stripForSpeech('## Hello **world** and _friends_');
    assert.equal(out, 'Hello world and friends');
  });

  it('shortens bare URLs to hostname', () => {
    const out = stripForSpeech('See https://www.example.com/path/to/page?x=1 for details');
    assert.match(out, /example\.com/);
    assert.doesNotMatch(out, /https:\/\//);
    assert.doesNotMatch(out, /path\/to/);
  });

  it('uses link labels instead of markdown URLs', () => {
    const out = stripForSpeech('Click [docs](https://example.com/very/long) now');
    assert.equal(out, 'Click docs now');
  });

  it('unwraps inline code', () => {
    assert.equal(stripForSpeech('Use `npm test` please'), 'Use npm test please');
  });
});
