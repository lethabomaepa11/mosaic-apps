import assert from 'node:assert/strict';
import test from 'node:test';
import { aiJson } from '../src/lib/server/ai';

const request = { name: 'test', system: '', user: '', schema: {}, config: { provider: 'openai' as const, apiKey: 'test-key' } };

test('a long AI cooldown returns immediately with the provider wait', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429, headers: { 'retry-after': '65' } }));
  const onWait = t.mock.fn();
  await assert.rejects(aiJson({ ...request, onWait }), /AI rate limit reached.*2 min/);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(onWait.mock.callCount(), 0);
});

test('a short AI cooldown is retried only once', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429, headers: { 'retry-after': '0.01' } }));
  const onWait = t.mock.fn();
  await assert.rejects(aiJson({ ...request, onWait }), /AI rate limit reached/);
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(onWait.mock.callCount(), 1);
});
