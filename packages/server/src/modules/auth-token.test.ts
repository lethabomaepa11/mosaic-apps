import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRequestToken } from './auth.js';
import { createMosaicServer } from '../app.js';

test('request auth prefers bearer tokens and supports the SSR session cookie', () => {
  assert.equal(resolveRequestToken('Bearer sdk-token', 'mosaic_session=cookie-token'), 'sdk-token');
  assert.equal(resolveRequestToken('', 'theme=dark; mosaic_session=cookie%20token; other=1'), 'cookie token');
  assert.equal(resolveRequestToken('', 'theme=dark'), '');
  assert.equal(resolveRequestToken('', 'mosaic_session=%E0%A4%A'), '');
});

test('login cookie authenticates same-origin SSR requests', async () => {
  const server = await createMosaicServer({
    databaseUrl: 'pglite://memory',
    auth: { enabled: true, jwtSecret: 'test-secret-that-is-at-least-32-characters' },
    seed: { admin: { email: 'admin@example.test', password: 'password123', name: 'Admin' }, demo: false },
  });
  try {
    const login = await server.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'password123' }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie ?? '', /mosaic_session=/);
    assert.match(cookie ?? '', /HttpOnly/i);
    assert.match(cookie ?? '', /SameSite=Lax/i);

    const me = await server.app.request('/api/auth/me', { headers: { cookie: cookie!.split(';')[0]! } });
    assert.equal(me.status, 200);
    const body = (await me.json()) as { data: { email: string } };
    assert.equal(body.data.email, 'admin@example.test');
  } finally {
    await server.close();
  }
});
