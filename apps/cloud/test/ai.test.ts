import assert from 'node:assert/strict';
import test from 'node:test';
import { aiJson, parseWait } from '../src/lib/server/ai';

const request = { name: 'test', system: '', user: '', schema: {}, config: { provider: 'openai' as const, apiKey: 'test-key' } };

test('provider reset headers can specify hours', () => {
  assert.equal(parseWait('1h2m3.5s'), 3_723_500);
  assert.equal(parseWait('1800'), 1_800_000);
});

test('a long AI cooldown returns immediately with the provider wait', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429, headers: { 'retry-after': '65' } }));
  const onWait = t.mock.fn();
  await assert.rejects(aiJson({ ...request, onWait }), /rate limit reached.*2 min/);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(onWait.mock.callCount(), 0);
});

test('a short AI cooldown is retried only once', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429, headers: { 'retry-after': '0.01' } }));
  const onWait = t.mock.fn();
  await assert.rejects(aiJson({ ...request, onWait }), /rate limit reached/);
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(onWait.mock.callCount(), 1);
});

test('Groq switches models immediately and avoids a throttled model for subsequent calls', async (t) => {
  const saved = process.env.GROQ_API_KEY;
  const savedModel = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = 'test-key';
  process.env.GROQ_MODEL = 'openai/gpt-oss-120b';
  t.after(() => {
    if (saved === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = saved;
    if (savedModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = savedModel;
  });
  const requested: string[] = [];
  let limitPrimary = false;
  let fallbackLimited = false;
  const primaryPending = Promise.withResolvers<void>();
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const { model } = JSON.parse(String(init.body));
    requested.push(model);
    if (model === 'openai/gpt-oss-120b') {
      if (limitPrimary) return new Response(null, { status: 429, headers: { 'retry-after': '1800' } });
      await primaryPending.promise;
    }
    if (fallbackLimited) return new Response(null, { status: 429, headers: { 'retry-after': '170' } });
    return Response.json({ model, choices: [{ message: { content: '{"ok":true}' } }] });
  });
  const onModel = t.mock.fn();
  const onWait = t.mock.fn();
  const groq = { ...request, config: { provider: 'mosaic' as const, onModel }, onWait };
  const first = aiJson(groq);
  try {
    const second = aiJson(groq);
    assert.deepEqual(requested, ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    assert.deepEqual(await second, { ok: true });
  } finally { primaryPending.resolve(); }
  assert.deepEqual(await first, { ok: true });
  requested.length = 0;
  limitPrimary = true;
  assert.deepEqual(await aiJson(groq), { ok: true });
  assert.deepEqual(await aiJson(groq), { ok: true });
  assert.equal(requested.filter((id) => id === 'openai/gpt-oss-120b').length, 1);
  assert.deepEqual(requested.slice(-2), ['openai/gpt-oss-20b', 'openai/gpt-oss-20b']);
  assert.equal(onModel.mock.calls[0]?.arguments[0], 'openai/gpt-oss-20b');
  fallbackLimited = true;
  await assert.rejects(aiJson(groq), /Groq rate limit reached.*3 min/);
  const calls = requested.length;
  await assert.rejects(aiJson(groq), /Groq rate limit reached/);
  assert.equal(requested.length, calls);
  assert.equal(onWait.mock.callCount(), 0);
});
