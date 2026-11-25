import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import test from 'node:test';

test('Next.js hosts the Mosaic API and preserves its session and page access checks', { timeout: 45_000 }, async () => {
  const socket = createServer().listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const { port } = socket.address();
  await new Promise((resolve) => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const email = 'next-smoke@example.test';
  const password = 'local-nextjs-smoke-test-password';
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: {
      ...process.env, NODE_ENV: 'production', VERCEL: '', DATABASE_URL: 'pglite://memory',
      MOSAIC_JWT_SECRET: 'local-nextjs-smoke-signing-secret-32-characters', ADMIN_EMAIL: email, ADMIN_PASSWORD: password,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const exit = once(server, 'exit');
  let logs = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', (chunk) => { logs += chunk; });
  const request = (path, init) => fetch(origin + path, { signal: AbortSignal.timeout(5000), ...init });

  try {
    let healthy = false;
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline && server.exitCode === null) {
      const response = await request('/api/health').catch(() => null);
      if (response?.ok) { healthy = true; break; }
      await sleep(250);
    }
    assert.ok(healthy, logs);
    assert.match(await (await request('/')).text(), /Mosaic on Next\.js/);

    const headers = { 'content-type': 'application/json' };
    const post = (path, body) => request(path, { method: 'POST', headers, body: JSON.stringify(body) });
    const login = await post('/api/auth/login', { email, password });
    assert.equal(login.status, 200);
    const session = login.headers.get('set-cookie');
    assert.match(session, /HttpOnly/i);
    headers.cookie = session.split(';')[0];
    assert.equal((await request('/api/auth/me', { headers })).status, 200);

    const created = await post('/api/pages', { name: 'Private page', route: '/private-page', settings: { requiresAuth: true } });
    assert.equal(created.status, 201);
    const { data: page } = await created.json();
    assert.equal((await post(`/api/pages/${page.id}/publish`, {})).status, 200);
    assert.equal((await request(`/api/pages/${page.id}`)).status, 401);
    assert.equal((await request(`/api/pages/${page.id}`, { headers })).status, 200);
    const { data: pages } = await (await request('/api/pages?published=true')).json();
    assert.ok(!pages.some((item) => item.id === page.id));
  } finally {
    server.kill();
    await exit;
  }
});
