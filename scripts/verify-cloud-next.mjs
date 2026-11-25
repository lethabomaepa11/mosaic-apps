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
if (!npm) throw new Error('Run through npm run test:cloud-next.');
const app = await mkdtemp(join(tmpdir(), 'mosaic-cloud-next-'));
const spec = structuredClone(equipmentSpec);
spec.pages.find((page) => page.route === '/').slug = 'equipment-home';
const compiled = compileSpec(spec);
for (const file of generateProjectFiles({ name: 'Equipment smoke', slug: 'equipment-smoke', framework: 'nextjs', theme: 'nord', spec, app: compiled })) {
  const path = join(app, file.path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.content);
}
for (const args of [['ci', '--prefer-offline', '--no-audit', '--no-fund'], ['run', 'build']]) {
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
const database = process.env.TEST_CLOUD_NEXT_DATABASE_URL;
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: app, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, NODE_ENV: 'production', VERCEL: database ? '1' : '', DATABASE_URL: database ?? 'pglite://memory',
    ADMIN_EMAIL: email, ADMIN_PASSWORD: password, MOSAIC_JWT_SECRET: 'cloud-next-local-test-secret-at-least-32-characters' },
});
const stopped = once(next, 'exit');
const request = (path, options) => fetch(host + path, { signal: AbortSignal.timeout(25_000), ...options });
try {
  let health;
  for (let attempt = 0; attempt < 50; attempt++) {
    assert.equal(next.exitCode, null);
    health = await request('/api/health').catch(() => null);
    if (health?.ok) break;
    await sleep(300);
  }
  assert.equal(health?.status, 200);
  assert.equal((await health.json()).data.db, true);
  const home = await request('/');
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /data-theme="nord"/);
  assert.ok(html.includes(spec.pages.find((page) => page.route === '/').title));
  const protectedRoute = await request('/loans', { redirect: 'manual' });
  assert.equal(protectedRoute.status, 307);
  const credentials = await request('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  assert.equal(credentials.status, 200);
  const headers = { cookie: credentials.headers.get('set-cookie').split(';')[0], 'content-type': 'application/json' };
  const loans = await request('/loans', { headers });
  assert.equal(loans.status, 200);
  assert.match(await loans.text(), /New record/);
  const form = await request('/f/loan-form', { headers });
  assert.equal(form.status, 200);
  assert.match(await form.text(), /name="item"/);
  const fields = compiled.entities.find((entity) => entity.name === 'employee').fields;
  const employee = Object.fromEntries(fields.filter((field) => field.required).map((field) => [
    field.name, field.format === 'email' ? 'cloud-next-person@example.test' : 'Cloud Next Test',
  ]));
  const record = await request('/api/entities/employee', { method: 'POST', headers, body: JSON.stringify(employee) });
  assert.equal(record.status, 201, await record.text());
  console.log('Cloud-generated Next.js release passed boot import, PostgreSQL health, routing, auth, forms and record creation.');
} finally {
  next.kill();
  await stopped;
}
