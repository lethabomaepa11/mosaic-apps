import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMosaicServer } from '../app.js';

const origin = 'https://app.example.test';
const admin = { email: 'admin@example.test', password: 'test-passphrase' };
const cookie = (response: Response, prefix: string) => response.headers.getSetCookie()
  .find((item) => item.startsWith(prefix))?.split(';', 1)[0] ?? '';

test('OAuth validates browser state, provisions viewers, and links an existing account only with its session', async (t) => {
  const server = await createMosaicServer({
    databaseUrl: 'pglite://memory', seed: { admin, demo: false },
    auth: { allowRegistration: true, oauth: { origin, google: { clientId: 'google-id', clientSecret: 'google-secret' }, github: { clientId: 'github-id', clientSecret: 'github-secret' } } },
  });
  t.after(() => server.close());
  let email = admin.email;
  let subject = 'admin-external-id';
  let challenge = '';
  let exchanges = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      exchanges++;
      const body = init?.body as URLSearchParams;
      assert.equal(body.get('redirect_uri'), `${origin}/api/auth/oauth/google/callback`);
      assert.equal(createHash('sha256').update(body.get('code_verifier')!).digest('base64url'), challenge);
      return Response.json({ access_token: 'provider-access-token' });
    }
    if (url === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'github-access-token' });
    if (url === 'https://api.github.com/user') return Response.json({ id: 1234, login: 'github-user' });
    if (url === 'https://api.github.com/user/emails') return Response.json([
      { primary: true, verified: false, email: 'unverified@example.test' },
      { primary: false, verified: true, email: 'secondary@example.test' },
    ]);
    assert.equal(url, 'https://openidconnect.googleapis.com/v1/userinfo');
    return Response.json({ sub: subject, email, email_verified: true, name: 'Provider account' });
  });
  const startPath = '/api/auth/oauth/google/start?next=%2Fdashboard';
  const callback = async (start: Response, session = '', override?: string) => {
    assert.equal(start.status, 303);
    const location = new URL(start.headers.get('location')!);
    challenge = location.searchParams.get('code_challenge')!;
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    const state = override ?? location.searchParams.get('state');
    const flow = cookie(start, 'mosaic_oauth_google=');
    assert.notEqual(flow, '');
    return server.app.request(`/api/auth/oauth/google/callback?code=provider-code&state=${state}`, {
      headers: { Cookie: session ? `${flow}; ${session}` : flow },
    });
  };
  assert.deepEqual((await (await server.app.request('/api/auth/oauth')).json() as any).data.providers, [
    { id: 'google', label: 'Google' }, { id: 'github', label: 'GitHub' },
  ]);
  assert.equal((await callback(await server.app.request(startPath), '', 'wrong-state')).headers.get('location'), '/login?oauth=invalid');
  assert.equal(exchanges, 0);
  const sameEmail = await callback(await server.app.request(startPath));
  assert.equal(sameEmail.headers.get('location'), '/login?oauth=existing');
  assert.equal(cookie(sameEmail, 'mosaic_session='), '');

  const login = await server.app.request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(admin),
  });
  const session = cookie(login, 'mosaic_session=');
  assert.equal((await server.app.request(startPath, { method: 'POST', headers: { Cookie: session } })).status, 403);
  const linked = await callback(await server.app.request(startPath, { method: 'POST', headers: { Cookie: session, Origin: origin } }), session);
  assert.equal(linked.headers.get('location'), '/dashboard');
  assert.ok(cookie(await callback(await server.app.request(startPath)), 'mosaic_session='));

  email = 'employee@example.test';
  subject = 'employee-external-id';
  const signedUp = await callback(await server.app.request(startPath));
  const me = await server.app.request('/api/auth/me', { headers: { Cookie: cookie(signedUp, 'mosaic_session=') } });
  assert.deepEqual((await me.json() as any).data.roles, ['viewer']);

  const github = await server.app.request('/api/auth/oauth/github/start');
  const githubState = new URL(github.headers.get('location')!).searchParams.get('state');
  const unverified = await server.app.request(`/api/auth/oauth/github/callback?code=github-code&state=${githubState}`, {
    headers: { Cookie: cookie(github, 'mosaic_oauth_github=') },
  });
  assert.equal(unverified.headers.get('location'), '/login?oauth=email');
  assert.equal(cookie(unverified, 'mosaic_session='), '');
});

test('notification routing requires permissions and sends only to the configured ntfy topic', async (t) => {
  const server = await createMosaicServer({
    databaseUrl: 'pglite://memory', seed: { admin, demo: false },
    notifications: { provider: 'ntfy', server: 'https://notifications.example.test', topic: 'staff', token: 'server-token' },
  });
  t.after(() => server.close());
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls++;
    assert.equal(url, 'https://notifications.example.test/');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer server-token');
    assert.deepEqual(JSON.parse(String(init?.body)), { topic: 'staff', title: 'Leave request', message: 'A request is ready for review.' });
    return Response.json({});
  });
  const body = JSON.stringify({ title: 'Leave request', message: 'A request is ready for review.', topic: 'untrusted-topic' });
  assert.equal((await server.app.request('/api/notifications', { method: 'POST', body })).status, 403);
  assert.equal(calls, 0);
  const login = await server.app.request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(admin),
  });
  const result = await server.app.request('/api/notifications', {
    method: 'POST', headers: { Cookie: cookie(login, 'mosaic_session='), 'Content-Type': 'application/json' }, body,
  });
  assert.equal(result.status, 202);
  assert.equal(calls, 1);
});

test('Resend requires an email recipient and uses the configured sender', async (t) => {
  const server = await createMosaicServer({
    databaseUrl: 'pglite://memory', seed: { admin, demo: false },
    notifications: { provider: 'resend', from: 'desk@example.test', apiKey: 'server-key' },
  });
  t.after(() => server.close());
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls++;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer server-key');
    assert.deepEqual(JSON.parse(String(init?.body)), { from: 'desk@example.test', to: ['staff@example.test'], subject: 'Update', text: 'Here is the update.' });
    return Response.json({ id: 'accepted' });
  });
  const login = await server.app.request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(admin),
  });
  const send = (to?: string) => server.app.request('/api/notifications', {
    method: 'POST', headers: { Cookie: cookie(login, 'mosaic_session='), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Update', message: 'Here is the update.', to }),
  });
  assert.equal((await send()).status, 422);
  assert.equal(calls, 0);
  assert.equal((await send('staff@example.test')).status, 202);
  assert.equal(calls, 1);
});
