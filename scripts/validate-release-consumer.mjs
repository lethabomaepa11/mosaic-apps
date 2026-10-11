/** Install packed artifacts outside the checkout and build a generated consumer. */
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const repository = resolve(fileURLToPath(new URL('..', import.meta.url)));
const artifacts = resolve(process.argv[2] ?? join(repository, '.tmp-generated/browser-smoke'));
const directory = await mkdtemp(join(tmpdir(), 'mosaic-release-consumer-'));
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run release:consumer so npm_execpath is available.');
const packages = ['core', 'server', 'ui', 'cli'];
const dependencies = Object.fromEntries(await Promise.all(packages.map(async (name) => {
  const manifest = JSON.parse(await readFile(join(repository, 'packages', name, 'package.json'), 'utf8'));
  const path = join(artifacts, `mosaic-apps-${name}-${manifest.version}.tgz`);
  await readFile(path);
  return [manifest.name, `file:${path.replaceAll('\\', '/')}`];
})));

function run(args, cwd, env = process.env) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit', shell: false, windowsHide: true });
  if (result.status !== 0) throw new Error(`Consumer check failed (exit ${result.status}): ${args.join(' ')}`);
}

await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'mosaic-release-consumer', private: true, type: 'module', dependencies }, null, 2));
console.log(`[mosaic] isolated consumer: ${directory}`);
run([npm, 'install', '--no-audit', '--no-fund'], directory);

const cli = join(directory, 'node_modules/@mosaic-apps/cli/dist/index.js');
run([cli, 'create', 'reference-app', '--npm-mode', '--no-install', '--no-git', '--no-pwa', '--db', 'pglite://memory', '--port', '3101', '--web-port', '3100'], directory);
const app = join(directory, 'reference-app');

async function rewrite(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await rewrite(path);
    else if (entry.name === 'package.json') {
      const manifest = JSON.parse(await readFile(path, 'utf8'));
      if (path === join(app, 'package.json')) manifest.devDependencies = { ...manifest.devDependencies, ...dependencies };
      for (const section of ['dependencies', 'devDependencies']) {
        for (const name of Object.keys(manifest[section] ?? {})) {
          if (dependencies[name]) manifest[section][name] = dependencies[name];
        }
      }
      await writeFile(path, JSON.stringify(manifest, null, 2));
    }
  }
}
await rewrite(app);
await mkdir(join(app, 'evidence'), { recursive: true });
run([npm, 'install', '--no-audit', '--no-fund'], app);
run([npm, 'run', 'check', '-w', 'apps/web'], app);
run([npm, 'run', 'check', '-w', 'apps/studio'], app);
run([npm, 'run', 'build'], app);
run([npm, 'run', 'build', '-w', 'apps/web'], app, { ...process.env, MOSAIC_DEPLOY_TARGET: 'netlify' });

const development = spawn(process.execPath, [npm, 'run', 'dev'], { cwd: app, detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
for (const stream of [development.stdout, development.stderr]) stream.on('data', (chunk) => { logs = (logs + chunk.toString()).slice(-60_000); });
async function waitHealthy(url) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (development.exitCode !== null) throw new Error(`Generated dev stack exited before ${url} became healthy.`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(3000) })).ok) return; } catch { /* Waiting for startup. */ }
    await new Promise((resolveReady) => setTimeout(resolveReady, 300));
  }
  throw new Error(`Generated app did not become healthy at ${url}.`);
}
try {
  await Promise.all([
    waitHealthy('http://127.0.0.1:3101/api/health'),
    waitHealthy('http://127.0.0.1:3100/'),
    waitHealthy('http://127.0.0.1:3100/api/health'),
    waitHealthy('http://127.0.0.1:3002/studio'),
    waitHealthy('http://127.0.0.1:3002/api/health'),
  ]);
} catch (error) { console.error(logs); throw error; }
finally {
  await writeFile(join(app, 'evidence', 'dev-startup.log'), logs);
  if (development.exitCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(development.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else process.kill(-development.pid, 'SIGTERM');
  }
}
console.log(`[mosaic] packed consumer passed: install, bundled CLI scaffolding, API/web/Studio builds, Netlify build, generated dev startup and both API proxies. Evidence retained at ${directory}`);
