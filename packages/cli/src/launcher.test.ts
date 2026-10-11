import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';

async function freePort() {
  const server = createServer();
  await new Promise<void>((accept) => server.listen(0, '127.0.0.1', accept));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((accept) => server.close(() => accept()));
  return port;
}

async function fixture(t: { after: (fn: () => Promise<void>) => void }, mode: 'normal' | 'fail-api' | 'fail-web' = 'normal') {
  const root = await mkdtemp(join(tmpdir(), 'mosaic launcher '));
  t.after(async () => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    await rm(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  });
  const ports = [await freePort(), await freePort(), await freePort()];
  await mkdir(join(root, 'scripts'));
  await copyFile(fileURLToPath(new URL('../../../templates/fullstack/scripts/dev.mjs', import.meta.url)), join(root, 'scripts/dev.mjs'));
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, workspaces: ['apps/*'] }));
  await writeFile(join(root, 'mosaic.config.json'), JSON.stringify({ api: { port: ports[0] }, web: { port: ports[1] }, studio: { port: ports[2] } }));
  for (const [i, name] of ['api', 'web', 'studio'].entries()) {
    const directory = join(root, 'apps', name);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name: `fixture-${name}`, private: true, scripts: { dev: 'node fixture.mjs' } }));
    const fail = mode === `fail-${name}`;
    await writeFile(join(directory, 'fixture.mjs'), fail ? 'setTimeout(() => process.exit(7), 800);' : `
      import { createServer } from 'node:http';
      createServer((req, res) => {
        if (req.url === '/crash') { process.exit(7); }
        res.setHeader('x-mosaic-dev-instance', process.env.MOSAIC_DEV_INSTANCE);
        res.end('ready');
      }).listen(Number(process.env.${i === 0 ? 'PORT' : i === 1 ? 'MOSAIC_WEB_PORT' : 'MOSAIC_STUDIO_PORT'}), '127.0.0.1');
    `);
  }
  const env = { ...process.env };
  for (const key of ['PORT', 'MOSAIC_WEB_PORT', 'MOSAIC_STUDIO_PORT']) delete env[key];
  const child = spawn(process.execPath, ['scripts/dev.mjs'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (data) => { output += data.toString(); });
  child.stderr.on('data', (data) => { output += data.toString(); });
  t.after(async () => {
    if (child.exitCode === null && child.pid) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else child.kill('SIGTERM');
    }
  });
  return { child, ports, output: () => output };
}

async function waitFor(check: () => boolean | Promise<boolean>, detail: () => string) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((accept) => setTimeout(accept, 100));
  }
  assert.fail(detail());
}

test('API failure stops startup before launching frontends', async (t) => {
  const app = await fixture(t, 'fail-api');
  await waitFor(() => app.child.exitCode !== null, app.output);
  assert.notEqual(app.child.exitCode, 0);
  assert.doesNotMatch(app.output(), /API ready|fixture-web|fixture-studio/);
});

test('frontend failure cleans up API and sibling frontend process trees', async (t) => {
  const app = await fixture(t, 'fail-web');
  await waitFor(() => app.child.exitCode !== null, app.output);
  assert.match(app.output(), /API ready/);
  assert.notEqual(app.child.exitCode, 0);
  for (const port of app.ports) {
    const server = createServer();
    await new Promise<void>((accept, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => server.close(() => accept()));
    });
  }
});

test('occupied API port is rejected before trusting another application health', async (t) => {
  const occupied = createServer();
  await new Promise<void>((accept) => occupied.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise<void>((accept) => occupied.close(() => accept())));
  const port = (occupied.address() as { port: number }).port;
  const root = await mkdtemp(join(tmpdir(), 'mosaic occupied '));
  t.after(async () => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); await rm(root, { recursive: true, force: true }); });
  await mkdir(join(root, 'scripts'));
  await copyFile(fileURLToPath(new URL('../../../templates/fullstack/scripts/dev.mjs', import.meta.url)), join(root, 'scripts/dev.mjs'));
  await writeFile(join(root, 'mosaic.config.json'), JSON.stringify({ api: { port }, web: { port: await freePort() }, studio: { port: await freePort() } }));
  const cleanEnv = { ...process.env }; delete cleanEnv.PORT;
  const child = spawn(process.execPath, ['scripts/dev.mjs'], { cwd: root, env: cleanEnv, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = '';
  child.stderr.on('data', (data) => { output += data.toString(); });
  await waitFor(() => child.exitCode !== null, () => output);
  assert.match(output, /api port .* unavailable/);
  assert.doesNotMatch(output, /API ready/);
});
