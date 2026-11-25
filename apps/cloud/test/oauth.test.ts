import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeUrl, exchangeCode, oauthConfig } from '../src/lib/server/oauth';
import { createVercelProject, deployToVercel, vercelDeploymentStatus } from '../src/lib/server/delivery';

const github = { clientId: 'gh-client', clientSecret: 'gh-secret' };
const vercel = { clientId: 'v-client', clientSecret: 'v-secret', slug: 'mosaic-cloud' };

function stubFetch(handler: (url: string, init: RequestInit) => unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    const [status, body] = handler(String(input), init) as [number, unknown];
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = real; } };
}

test('OAuth is offered only when its client credentials are configured', () => {
  delete process.env.GITHUB_OAUTH_CLIENT_ID; delete process.env.GITHUB_OAUTH_CLIENT_SECRET;
  assert.equal(oauthConfig('github'), undefined);
  assert.equal(oauthConfig('neon'), undefined);
  process.env.GITHUB_OAUTH_CLIENT_ID = 'id'; process.env.GITHUB_OAUTH_CLIENT_SECRET = 'secret';
  assert.deepEqual(oauthConfig('github'), { clientId: 'id', clientSecret: 'secret' });
  delete process.env.GITHUB_OAUTH_CLIENT_ID; delete process.env.GITHUB_OAUTH_CLIENT_SECRET;
});

test('authorize URLs carry the state and the exact callback', () => {
  const gh = new URL(authorizeUrl('github', github, 'https://cloud.example', 'abc'));
  assert.equal(gh.origin + gh.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(gh.searchParams.get('state'), 'abc');
  assert.equal(gh.searchParams.get('scope'), 'repo');
  assert.equal(gh.searchParams.get('redirect_uri'), 'https://cloud.example/settings/connections/github/callback');
  const v = new URL(authorizeUrl('vercel', vercel, 'https://cloud.example', 'xyz'));
  assert.equal(v.pathname, '/integrations/mosaic-cloud/new');
  assert.equal(v.searchParams.get('state'), 'xyz');
});

test('code exchange returns the token and Vercel team, and rejects GitHub 200-with-error replies', async () => {
  let stub = stubFetch((url) => url.includes('github') ? [200, { error: 'bad_verification_code', error_description: 'The code is incorrect or expired.' }] : [200, { access_token: 'v-token', team_id: 'team_1' }]);
  try {
    await assert.rejects(exchangeCode('github', github, 'https://cloud.example', 'old'), /incorrect or expired/);
    assert.deepEqual(await exchangeCode('vercel', vercel, 'https://cloud.example', 'c'), { token: 'v-token', teamId: 'team_1' });
    assert.match(String(stub.calls[1]!.init.body), /client_secret=v-secret/);
  } finally { stub.restore(); }
  stub = stubFetch(() => [200, { access_token: 'gh-token' }]);
  try { assert.deepEqual(await exchangeCode('github', github, 'https://cloud.example', 'c'), { token: 'gh-token', teamId: null }); } finally { stub.restore(); }
});

test('every Vercel call names the team for team installs, and none for personal tokens', async () => {
  const stub = stubFetch((url) => url.includes('/v11/projects') ? [200, { id: 'prj' }] : url.includes('/v13/deployments/') ? [200, { readyState: 'READY', alias: ['a.vercel.app'] }] : url.includes('/v13/deployments') ? [200, { id: 'dpl' }] : [200, {}]);
  try {
    await createVercelProject({ token: 't', name: 'app', teamId: 'team_1' });
    await deployToVercel({ token: 't', projectId: 'prj', name: 'app', files: [{ path: 'package.json', content: '{}' }], env: { DATABASE_URL: 'x' }, teamId: 'team_1' });
    await vercelDeploymentStatus('t', 'dpl', 'team_1');
    assert.ok(stub.calls.every((call) => new URL(call.url).searchParams.get('teamId') === 'team_1'), 'all team calls scoped');
    assert.ok(stub.calls.some((call) => new URL(call.url).searchParams.get('upsert') === 'true'), 'env upsert flag kept');
    const settings = stub.calls.find((call) => new URL(call.url).pathname === '/v9/projects/prj');
    assert.equal(settings?.init.method, 'PATCH');
    assert.equal(JSON.parse(String(settings?.init.body)).rootDirectory, null);
    const installCommand = JSON.parse(String(settings?.init.body)).installCommand;
    assert.match(installCommand, /^npm install --no-save --package-lock=false /);
    for (const pkg of ['core', 'server', 'ui', 'sveltekit']) assert.ok(installCommand.includes(`@mosaic-apps/${pkg}@latest`));
    assert.equal(JSON.parse(String(settings?.init.body)).buildCommand, 'npm exec -- svelte-kit sync && npm run build');
    stub.calls.length = 0;
    await createVercelProject({ token: 't', name: 'app' });
    assert.equal(new URL(stub.calls[0]!.url).searchParams.has('teamId'), false);
  } finally { stub.restore(); }
});
