import assert from 'node:assert/strict';
import test from 'node:test';
import { aiJson, parseWait } from '../src/lib/server/ai';

const request = { name: 'test', system: '', user: '', schema: {}, config: { provider: 'openai' as const, apiKey: 'test-key' } };

test('a Gemini 503 falls back to another Flash-Lite model using the same key', async (t) => {
  const models: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('x-goog-api-key'), 'own-test-key');
    models.push(url.split('/').at(-1)!.split(':')[0]!);
    if (models.length === 1) return new Response(null, { status: 503 });
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }] });
  });
  const onModel = t.mock.fn();
  assert.deepEqual(await aiJson({ ...request, config: { provider: 'gemini', apiKey: 'own-test-key', onModel } }), { ok: true });
  assert.deepEqual(models, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
  assert.equal(onModel.mock.calls[0]?.arguments[0], 'gemini-3.1-flash-lite');
});

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
  const savedGemini = process.env.GEMINI_FALLBACK_API_KEY;
  delete process.env.GEMINI_FALLBACK_API_KEY;
  process.env.GROQ_API_KEY = 'test-key';
  process.env.GROQ_MODEL = 'openai/gpt-oss-120b';
  t.after(() => {
    if (saved === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = saved;
    if (savedModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = savedModel;
    if (savedGemini !== undefined) process.env.GEMINI_FALLBACK_API_KEY = savedGemini;
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

test('shared builds use Gemini when Groq fails and keep credentials and schema scoped to each provider', async (t) => {
  const now = Date.now() + 3_600_000;
  t.mock.method(Date, 'now', () => now);
  const saved = { GROQ_API_KEY: process.env.GROQ_API_KEY, GROQ_MODEL: process.env.GROQ_MODEL, GEMINI_FALLBACK_API_KEY: process.env.GEMINI_FALLBACK_API_KEY };
  Object.assign(process.env, { GROQ_API_KEY: 'groq-test', GROQ_MODEL: 'qwen/qwen3.8-27b', GEMINI_FALLBACK_API_KEY: 'gemini-test' });
  t.after(() => { for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
  const attempted: string[] = [];
  const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, additionalProperties: false, required: ['ok'] };
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    const body = JSON.parse(String(init.body));
    if (url.startsWith('https://api.groq.com/')) {
      attempted.push(body.model);
      assert.equal(headers.get('authorization'), 'Bearer groq-test');
      assert.equal(headers.has('x-goog-api-key'), false);
      if (body.model.startsWith('qwen/')) {
        assert.equal(body.reasoning_effort, undefined);
        return new Response(null, { status: 429, headers: { 'retry-after': '1800' } });
      }
      if (body.model.endsWith('20b')) throw new TypeError('network failure');
      return new Response(null, { status: 503 });
    }
    assert.match(url, /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
    attempted.push('gemini');
    assert.equal(headers.get('x-goog-api-key'), 'gemini-test');
    assert.equal(headers.has('authorization'), false);
    assert.deepEqual(body.generationConfig.responseJsonSchema, schema);
    return Response.json({ modelVersion: 'gemini-3.5-flash-lite', candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'hidden' }, { text: '{"ok":true}' }] } }] });
  });
  const onModel = t.mock.fn();
  const build = { ...request, schema, config: { provider: 'mosaic' as const, onModel } };
  assert.deepEqual(await aiJson(build), { ok: true });
  assert.deepEqual(await aiJson(build), { ok: true });
  assert.deepEqual(attempted, ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'gemini', 'gemini']);
  assert.equal(onModel.mock.calls[0]?.arguments[0], 'gemini-3.5-flash-lite');
});
