import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDataPath, resolveFormSource, loadFormSource } from './data-source.js';
import { MosaicClient } from '../client/api.js';

test('source expressions resolve query and scoped state without executing code', () => {
  assert.deepEqual(resolveFormSource({ kind: 'entity', entity: 'customer', recordId: '$query.id', where: { owner: '$application.userId' } }, { query: { id: 'abc' }, application: { userId: 'user1' } }), { kind: 'entity', entity: 'customer', recordId: 'abc', where: { owner: 'user1' } });
  assert.equal(readDataPath({}, 'constructor.prototype'), undefined);
  assert.deepEqual(resolveFormSource({ kind: 'static', data: { price: '$$100' } }, {}), { kind: 'static', data: { price: '$100' } });
});

test('missing record selection and malformed endpoint results are actionable', async () => {
  const client = new MosaicClient({ baseUrl: 'https://api.example.test/api' });
  await assert.rejects(loadFormSource({ kind: 'entity', entity: 'customer' }, client, { requireRecord: true }), /Select a record/);
  await assert.rejects(loadFormSource({ kind: 'endpoint', url: '/custom' }, client, { fetch: async () => Response.json([]) }), /record object/);
});

test('endpoint sources extract records and never forward auth tokens to another origin', async () => {
  const client = new MosaicClient({ baseUrl: 'https://api.example.test/api', token: 'local-test-token' });
  let headers: HeadersInit | undefined;
  const result = await loadFormSource({ kind: 'endpoint', url: 'https://integration.example.test/customer', recordPath: 'customer' }, client, { fetch: async (_url, init) => { headers = init?.headers; return Response.json({ customer: { name: 'Alex' } }); } });
  assert.deepEqual(result, { name: 'Alex' });
  assert.equal(new Headers(headers).get('Authorization'), null);
  await loadFormSource({ kind: 'endpoint', url: 'customer' }, client, { fetch: async (_url, init) => { headers = init?.headers; return Response.json({ success: true, data: { name: 'Alex' } }); } });
  assert.equal(new Headers(headers).get('Authorization'), 'Bearer local-test-token');
});

test('request cancellation reaches the endpoint transport', async () => {
  const client = new MosaicClient({ baseUrl: 'https://api.example.test/api' });
  const controller = new AbortController();
  let received: AbortSignal | null | undefined;
  await loadFormSource({ kind: 'endpoint', url: 'customer' }, client, { signal: controller.signal, fetch: async (_url, init) => { received = init?.signal; return Response.json({ name: 'Alex' }); } });
  assert.equal(received, controller.signal);
});
