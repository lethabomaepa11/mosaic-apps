import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { generateProjectFiles } from '../apps/cloud/src/lib/server/generation.ts';
import { compileSpec } from '../apps/cloud/src/lib/server/spec.ts';
import { equipmentSpec } from '../apps/cloud/test/fixtures/equipment-spec.ts';

const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run test:cloud-next or test:cloud-svelte.');
const framework = process.argv[2] === 'sveltekit' ? 'sveltekit' : 'nextjs';
const svelte = framework === 'sveltekit';
const app = await mkdtemp(join(tmpdir(), `mosaic-cloud-${framework}-`));
const spec = structuredClone(equipmentSpec);
spec.allowRegistration = true;
spec.pages.find((page) => page.route === '/').slug = 'equipment-home';
const adminLoans = spec.pages.find((page) => page.route === '/loans');
adminLoans.roles = ['admin'];
adminLoans.menuLabel = 'Loans administration';
spec.pages.find((page) => page.route === '/equipment').menuLabel = 'Equipment inventory';
const requestField = spec.entities.find((entity) => entity.name === 'employee').fields[0];
spec.entities.push({
  name: 'equipment_request', label: 'Equipment request', labelPlural: 'Equipment requests', labelField: 'reason', icon: '', description: '',
  fields: [
    { ...requestField, name: 'reason', label: 'Reason' },
    { ...requestField, name: 'requesterEmail', label: 'Requester', format: 'email' },
    { ...requestField, name: 'status', label: 'Status', type: 'enum', options: ['Pending Approval', 'Approved'] },
  ],
  permissions: { read: [], create: ['viewer'], update: [], delete: [] },
  submission: { managed: [
    { field: 'requesterEmail', source: 'userEmail', value: '' },
    { field: 'status', source: 'constant', value: 'Pending Approval' },
  ] },
});
const workflow = spec.pages.find((page) => page.route === '/dashboard');
workflow.kind = 'workflow';
workflow.sections = [
  { kind: 'records', title: 'Recent loans', body: '', entity: 'loan' },
  { kind: 'form', title: 'Lend equipment', body: 'Choose an item and a borrower.', entity: 'loan' },
];
const compiled = compileSpec(spec);
for (const file of generateProjectFiles({ name: 'Equipment smoke', slug: 'equipment-smoke', framework, theme: 'nord', spec, app: compiled })) {
  // Reproduce Vercel's uploaded-source install, where apps/web can be staged by itself.
  if (svelte && !file.path.startsWith('apps/web/')) continue;
  const path = join(app, svelte ? file.path.slice('apps/web/'.length) : file.path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.content);
}
for (const args of [[svelte ? 'install' : 'ci', svelte ? '--prefer-online' : '--prefer-offline', '--no-audit', '--no-fund'], ...(svelte ? [['run', 'check']] : []), ['run', 'build']]) {
  const run = spawnSync(process.execPath, [npm, ...args], { cwd: app, stdio: 'inherit', windowsHide: true });
  assert.equal(run.status, 0, `npm ${args.join(' ')} failed in ${app}`);
}
const socket = createServer().listen(0, '127.0.0.1');
await once(socket, 'listening');
const { port } = socket.address();
await new Promise((resolve) => socket.close(resolve));
const host = `http://127.0.0.1:${port}`;
const email = 'cloud-next-smoke@example.test';
const password = 'cloud-next-test-password-example';
const database = svelte ? process.env.TEST_CLOUD_SVELTE_DATABASE_URL : process.env.TEST_CLOUD_NEXT_DATABASE_URL;
const runtime = spawn(process.execPath, svelte ? ['build/index.js'] : ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: app, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, NODE_ENV: 'production', VERCEL: database ? '1' : '', DATABASE_URL: database ?? 'pglite://memory',
    HOST: '127.0.0.1', PORT: String(port), ORIGIN: host, SEED_DEMO: 'false',
    ADMIN_EMAIL: email, ADMIN_PASSWORD: password, MOSAIC_JWT_SECRET: 'cloud-next-local-test-secret-at-least-32-characters' },
});
const stopped = once(runtime, 'exit');
const request = (path, options) => fetch(host + path, { signal: AbortSignal.timeout(25_000), ...options });
try {
  let health;
  for (let attempt = 0; attempt < 50; attempt++) {
    assert.equal(runtime.exitCode, null);
    health = await request('/api/health').catch(() => null);
    if (health?.ok) break;
    await sleep(300);
  }
  assert.equal(health?.status, 200);
  assert.equal((await health.json()).data.db, true);
  const home = await request('/');
  assert.equal(home.status, 200);
  const html = await home.text();
  if (!svelte) assert.match(html, /data-theme="nord"/);
  assert.ok(html.includes(spec.pages.find((page) => page.route === '/').title));
  const protectedRoute = await request('/loans', { redirect: 'manual' });
  assert.ok([302, 303, 307].includes(protectedRoute.status));
  assert.match(await (await request('/login')).text(), /href="\/signup"/);
  assert.match(await (await request('/signup')).text(), /name="name"/);
  const signup = await request('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'New Borrower', email: 'borrower@example.test', password }),
  });
  assert.equal(signup.status, 201);
  assert.deepEqual((await signup.json()).data.user.roles, ['viewer']);
  const user = { cookie: signup.headers.get('set-cookie').split(';')[0] };
  const submit = (path, body) => request(path, {
    method: 'POST', headers: { ...user, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await submit('/api/entities/equipment_request', { reason: 'Field work' })).status, 403);
  assert.equal((await submit('/api/extensions/equipment-request/submit', { reason: 'Field work', status: 'approved' })).status, 422);
  const submitted = await submit('/api/extensions/equipment-request/submit', { reason: 'Field work' });
  assert.equal(submitted.status, 201, await submitted.clone().text());
  const { data: requestRecord } = await submitted.json();
  const dashboard = await request('/dashboard', { headers: user });
  assert.equal(dashboard.status, 200);
  const dashboardHtml = await dashboard.text();
  assert.match(dashboardHtml, /aria-label="Main navigation"/);
  assert.match(dashboardHtml, /Equipment inventory/);
  assert.doesNotMatch(dashboardHtml, /Loans administration/);
  assert.ok([403, 404].includes((await request('/loans', { headers: user })).status));
  assert.match(dashboardHtml, svelte ? /Lend equipment/ : /href="\/f\/loan-form">Lend equipment/);
  if (!svelte) assert.equal((await request('/studio', { headers: user })).status, 404);
  const credentials = await request('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  assert.equal(credentials.status, 200);
  const headers = { cookie: credentials.headers.get('set-cookie').split(';')[0], 'content-type': 'application/json' };
  const { data: savedRequest } = await (await request(`/api/entities/equipment_request/${requestRecord.id}`, { headers })).json();
  assert.equal(savedRequest.requesterEmail, 'borrower@example.test');
  assert.equal(savedRequest.status, 'pending_approval');
  const layout = await request('/api/pages/auth-signup', { headers });
  assert.equal(layout.status, 200);
  const { data: authPage } = await layout.json();
  if (!svelte) {
    const studio = await request(`/studio?page=${encodeURIComponent(authPage.id)}`, { headers });
    assert.equal(studio.status, 200);
    assert.match(await studio.text(), /Page Studio[\s\S]*Page JSON/);
    const sidebar = await request('/studio?sidebar', { headers });
    assert.equal(sidebar.status, 200);
    assert.match(await sidebar.text(), /Save sidebar/);
  }
  authPage.root.children[0].props.text = 'Join the equipment desk';
  const publish = await request(`/api/pages/${authPage.id}/save-and-publish`, {
    method: 'PUT', headers, body: JSON.stringify({ name: authPage.name, route: authPage.route, schema: authPage.root, settings: authPage.settings, expectedVersion: authPage.version }),
  });
  assert.equal(publish.status, 200, await publish.text());
  assert.match(await (await request('/signup')).text(), /Join the equipment desk/);
  const loans = await request('/loans', { headers });
  assert.equal(loans.status, 200);
  const loansHtml = await loans.text();
  assert.match(loansHtml, /Loans administration/);
  if (!svelte) assert.match(loansHtml, /New record/);
  const form = await request('/f/loan-form', { headers });
  assert.equal(form.status, 200);
  if (!svelte) assert.match(await form.text(), /name="item"/);
  const fields = compiled.entities.find((entity) => entity.name === 'employee').fields;
  const employee = Object.fromEntries(fields.filter((field) => field.required).map((field) => [
    field.name, field.format === 'email' ? 'cloud-next-person@example.test' : 'Cloud Next Test',
  ]));
  const record = await request('/api/entities/employee', { method: 'POST', headers, body: JSON.stringify(employee) });
  assert.equal(record.status, 201, await record.text());
  console.log(`Cloud-generated ${framework} release passed boot, database health, record creation, sign-up and editing the published sign-up page.`);
} finally {
  runtime.kill();
  await stopped;
}
