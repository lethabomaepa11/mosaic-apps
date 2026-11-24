import assert from 'node:assert/strict';
import test from 'node:test';
import { createMosaicServer } from '../app.js';

test('registered endpoints mount safely and enforce auth', async () => {
  const server = await createMosaicServer({
    databaseUrl: 'pglite://memory',
    auth: { enabled: true, jwtSecret: 'test-secret-that-is-at-least-32-characters' },
    endpoints: [
      {
        method: 'GET', path: '/hello/:name', summary: 'Say hello', public: true,
        responses: { 200: { description: 'Greeting' } },
        handler: ({ params, query }) => ({ message: `Hello ${params.name}`, from: query.from ?? 'Mosaic' }),
      },
      {
        method: 'POST', path: '/private', summary: 'Private extension',
        responses: { 200: { description: 'Accepted' } },
        handler: async ({ json }) => ({ received: await json() }),
      },
    ],
  });
  try {
    const hello = await server.app.request('/api/extensions/hello/Ada?from=Studio');
    assert.equal(hello.status, 200);
    assert.deepEqual(await hello.json(), { message: 'Hello Ada', from: 'Studio' });

    const privateResponse = await server.app.request('/api/extensions/private', { method: 'POST' });
    assert.equal(privateResponse.status, 401);
    assert.equal((await privateResponse.json() as { error: { code: string } }).error.code, 'UNAUTHENTICATED');
  } finally {
    await server.close();
  }
});

test('endpoint registrations reject duplicate routes', async () => {
  await assert.rejects(() => createMosaicServer({
    databaseUrl: 'pglite://memory',
    auth: { enabled: false },
    endpoints: [
      { method: 'GET', path: '/same', summary: 'One', responses: { 200: { description: 'OK' } }, handler: () => 1 },
      { method: 'GET', path: '/same', summary: 'Two', responses: { 200: { description: 'OK' } }, handler: () => 2 },
    ],
  }), /Duplicate Mosaic endpoint registration/);
});
