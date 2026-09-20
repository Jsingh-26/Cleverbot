import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { FALLBACK_MODELS, getModels } from '../src/lib/config.ts';

describe('react/convex scaffold smoke', () => {
  it('exposes a tiny offline fallback model list', () => {
    assert.ok(FALLBACK_MODELS.length > 0);
    assert.equal(getModels().length, FALLBACK_MODELS.length);
    assert.ok(getModels().every((id) => id === 'openrouter/free' || id.endsWith(':free')));
  });

  it('has Convex schema and auth files', () => {
    for (const path of [
      'convex/schema.ts',
      'convex/auth.ts',
      'convex/http.ts',
      'convex/threads.ts',
      'convex/messages.ts',
      'convex/users.ts',
      'src/main.tsx',
      'src/App.tsx',
    ]) {
      assert.ok(existsSync(path), `missing ${path}`);
    }
    const schema = readFileSync('convex/schema.ts', 'utf8');
    assert.match(schema, /authTables/);
    assert.match(schema, /threads/);
    assert.match(schema, /messages/);
  });

  it('uses live model ranking rather than a curated preference list', () => {
    const modelsFn = readFileSync('netlify/functions/models.mjs', 'utf8');
    assert.match(modelsFn, /openrouter-live|fetchRankedFreeModels/);
    const shared = readFileSync('netlify/functions/lib/openrouter-models.mjs', 'utf8');
    assert.match(shared, /DENY_RE|scoreModel|detectTask/);
    assert.doesNotMatch(modelsFn, /nemotron-3-ultra-550b/);
    const config = readFileSync('src/lib/config.ts', 'utf8');
    assert.match(config, /FALLBACK_MODELS/);
  });
});
