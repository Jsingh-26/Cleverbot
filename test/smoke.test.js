import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SUPPORTED_MODELS, getModels } from '../src/lib/config.ts';

describe('react/convex scaffold smoke', () => {
  it('exposes curated free models', () => {
    assert.ok(SUPPORTED_MODELS.length > 0);
    assert.equal(getModels().length, SUPPORTED_MODELS.length);
    assert.ok(getModels().every((id) => id.endsWith(':free')));
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
});
