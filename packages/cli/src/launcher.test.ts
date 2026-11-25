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

async function fixture(t: { after: (fn: () => Promise<void>) => void }, mode: 'fail-web' | 'crash-after-ready') {
  const root = await mkdtemp(join(tmpdir(), 'mosaic launcher '));
  t.after(async () => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    await rm(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  });
  const ports = [await freePort(), await freePort()];
  await mkdir(join(root, 'scripts'));
  await copyFile(fileURLToPath(new URL('../../../templates/fullstack/scripts/dev.mjs', import.meta.url)), join(root, 'scripts/dev.mjs'));
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, workspaces: ['apps/*'] }));
  await writeFile(join(root, 'mosaic.config.json'), JSON.stringify({ api: { port: ports[0] }, web: { port: ports[1] } }));
  const directory = join(root, 'apps', 'web');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'fixture-web', private: true, scripts: { dev: 'node fixture.mjs' } }));
  await writeFile(join(directory, 'fixture.mjs'), mode === 'fail-web' ? 'setTimeout(() => process.exit(7), 800);' : `
    import { createServer } from 'node:http';
    // Serve health long enough for the launcher to report ready, then crash.
    setTimeout(() => process.exit(7), 2500);
    createServer((req, res) => res.end('ready')).listen(Number(process.env.MOSAIC_WEB_PORT), '127.0.0.1');
  `);
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

async function portAvailable(port: number): Promise<boolean> {
  const server = createServer();
  return new Promise((accept) => {
    server.once('error', () => accept(false));
    server.listen(port, '127.0.0.1', () => server.close(() => accept(true)));
  });
}

test('application failure stops startup before reporting ready', async (t) => {
  const app = await fixture(t, 'fail-web');
  await waitFor(() => app.child.exitCode !== null, app.output);
  assert.notEqual(app.child.exitCode, 0);
  assert.doesNotMatch(app.output(), /Application ready/);
});

test('application crash after startup stops the launcher and frees the port', async (t) => {
  const app = await fixture(t, 'crash-after-ready');
  await waitFor(() => app.child.exitCode !== null, app.output);
  assert.match(app.output(), /Application ready on http:\/\/localhost:\d+ \(Studio: http:\/\/localhost:\d+\/studio\)/);
  assert.notEqual(app.child.exitCode, 0);
  await waitFor(() => portAvailable(app.ports[1]!), app.output);
});

test('occupied application port is rejected before trusting another application health', async (t) => {
  const occupied = createServer();
  await new Promise<void>((accept) => occupied.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise<void>((accept) => occupied.close(() => accept())));
  const port = (occupied.address() as { port: number }).port;
  const root = await mkdtemp(join(tmpdir(), 'mosaic occupied '));
  t.after(async () => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); await rm(root, { recursive: true, force: true }); });
  await mkdir(join(root, 'scripts'));
  await copyFile(fileURLToPath(new URL('../../../templates/fullstack/scripts/dev.mjs', import.meta.url)), join(root, 'scripts/dev.mjs'));
  await writeFile(join(root, 'mosaic.config.json'), JSON.stringify({ api: { port: await freePort() }, web: { port } }));
  const cleanEnv = { ...process.env }; delete cleanEnv.PORT;
  const child = spawn(process.execPath, ['scripts/dev.mjs'], { cwd: root, env: cleanEnv, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = '';
  child.stderr.on('data', (data) => { output += data.toString(); });
  await waitFor(() => child.exitCode !== null, () => output);
  assert.match(output, /web port .* unavailable/);
  assert.doesNotMatch(output, /Application ready/);
});
