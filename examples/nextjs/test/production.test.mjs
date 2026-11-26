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
  const testDatabase = process.env.TEST_NEXT_DATABASE_URL;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: {
      ...process.env, NODE_ENV: 'production', VERCEL: testDatabase ? '1' : '', DATABASE_URL: testDatabase ?? 'pglite://memory', SEED_DEMO: 'true',
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
    assert.equal((await request('/')).status, 200);

    const headers = { 'content-type': 'application/json' };
    const post = (path, body) => request(path, { method: 'POST', headers, body: JSON.stringify(body) });
    const login = await post('/api/auth/login', { email, password });
    assert.equal(login.status, 200);
    const session = login.headers.get('set-cookie');
    assert.match(session, /HttpOnly/i);
    headers.cookie = session.split(';')[0];
    assert.equal((await request('/api/auth/me', { headers })).status, 200);

    const created = await post('/api/pages', {
      name: 'Private page', route: '/private-page/:reference', settings: { requiresAuth: true },
      schema: { id: 'private-root', type: 'page', children: [{ id: 'private-title', type: 'heading', props: { text: 'Private report content' } }] },
    });
    assert.equal(created.status, 201);
    const { data: page } = await created.json();
    const studio = await request(`/studio/pages/${page.id}`, { headers });
    assert.equal(studio.status, 200);
    const studioHtml = await studio.text();
    const asset = studioHtml.match(/\/_mosaic-studio\/immutable\/entry\/start\.[\w-]+\.js/)?.[0];
    assert.ok(asset, studioHtml);
    assert.equal((await request(asset)).status, 200);
    const studioRedirect = await request('/studio', { redirect: 'manual' });
    assert.equal(studioRedirect.headers.get('location'), '/login?next=%2Fstudio');
    assert.equal((await request('/private-page/report-1', { headers })).status, 404);
    assert.equal((await post(`/api/pages/${page.id}/publish`, {})).status, 200);
    assert.equal((await request(`/api/pages/${page.id}`)).status, 401);
    assert.equal((await request(`/api/pages/${page.id}`, { headers })).status, 200);
    const { data: pages } = await (await request('/api/pages?published=true')).json();
    assert.ok(!pages.some((item) => item.id === page.id));
    const { data: routes } = await (await request('/api/pages?published=true&includeRestrictedRoutes=true')).json();
    assert.deepEqual(routes.find((item) => item.route === '/private-page/:reference'), { route: '/private-page/:reference' }, JSON.stringify(routes.map((item) => item.route)));
    const anonymous = await request('/private-page/report-1', { redirect: 'manual' });
    assert.equal(anonymous.status, 307);
    assert.equal(anonymous.headers.get('location'), '/login?next=%2Fprivate-page%2Freport-1');
    assert.doesNotMatch(await anonymous.text(), /Private report content/);
    const published = await request('/private-page/report-1', { headers });
    assert.equal(published.status, 200);
    assert.match(await published.text(), /Private report content/);
    const form = await request('/f/customer-form', { headers });
    assert.equal(form.status, 200);
    assert.match(await form.text(), /name="company"/);
    const record = await post('/api/entities/customer', { name: 'Next test customer', status: 'active' });
    assert.equal(record.status, 201, await record.text());
  } finally {
    server.kill();
    await exit;
  }
});
