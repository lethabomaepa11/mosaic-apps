/** Install packed artifacts outside the checkout and build a generated consumer. */
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const repository = resolve(fileURLToPath(new URL('..', import.meta.url)));
const artifacts = resolve(process.argv[2] ?? join(repository, '.tmp-generated/browser-smoke'));
// GitHub Windows TMP can contain an 8.3 username alias. Vite and Kit disagree
// about manifest paths under that alias; the runner's dedicated temp is stable.
const directory = await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'mosaic-release-consumer-'));
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run release:consumer so npm_execpath is available.');
const packages = ['core', 'server', 'sveltekit', 'ui', 'cli'];
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
const cliVersion = JSON.parse(await readFile(join(repository, 'packages/cli/package.json'), 'utf8')).version;
const reportedVersion = spawnSync(process.execPath, [cli, '--version'], { cwd: directory, encoding: 'utf8', windowsHide: true });
assert.equal(reportedVersion.status, 0, reportedVersion.stderr);
assert.equal(reportedVersion.stdout.trim(), `mosaic ${cliVersion}`);
// Exercise normal published defaults, including Git/PWA, rather than hiding
// scaffold failures behind --no-git/--npm-mode/--db overrides.
run([cli, 'create', 'reference-app', '--no-install', '--web-port', '3100'], directory);
const app = join(directory, 'reference-app');
if (!(await readFile(join(app, '.env'), 'utf8')).includes('DATABASE_URL=pglite://./data')) throw new Error('Embedded database default missing.');
if (!(await readFile(join(app, '.gitignore'), 'utf8')).includes('.env')) throw new Error('Packaged gitignore missing.');
const tracked = spawnSync('git', ['ls-files'], { cwd: app, encoding: 'utf8', shell: false });
if (tracked.status !== 0 || tracked.stdout.split(/\r?\n/).includes('.env')) throw new Error('Generated Git repository tracks secrets or initialization failed.');

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
run([npm, 'run', 'migrate', '--', '--dry-run'], app);
run([npm, 'run', 'check', '-w', 'apps/web'], app);
run([npm, 'run', 'build'], app);

const development = spawn(process.execPath, [npm, 'run', 'dev'], { cwd: app, env: process.env, detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const services = [development];
let logs = '';
for (const stream of [development.stdout, development.stderr]) stream.on('data', (chunk) => { logs = (logs + chunk.toString()).slice(-60_000); });
async function waitHealthy(url) {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (development.exitCode !== null) throw new Error(`Generated dev stack exited before ${url} became healthy.`);
    if (services.some((service) => service.exitCode !== null)) throw new Error(`A production frontend exited before ${url} became healthy.`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(15000) })).ok) return; } catch { /* Waiting for startup. */ }
    await new Promise((resolveReady) => setTimeout(resolveReady, 300));
  }
  throw new Error(`Generated app did not become healthy at ${url}.`);
}
try {
  await Promise.all([
    waitHealthy('http://127.0.0.1:3100/'),
    waitHealthy('http://127.0.0.1:3100/api/health'),
    // Use the light shell for readiness; the browser exercise below verifies the
    // full Studio after Vite has finished its first dependency optimization.
    waitHealthy('http://127.0.0.1:3100/studio/login'),
  ]);
  // HTTP health cannot detect a client prebundling failure. Exercise hydration
  // and Monaco with the installed npm package, not source aliases from the repo.
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MOSAIC_BROWSER_EXECUTABLE_PATH ?? (process.platform === 'win32' && existsSync(edge) ? edge : undefined) });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const hydrated = page.waitForResponse((response) => response.url().includes('/api/auth/me'));
    await page.goto('http://127.0.0.1:3100/studio/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await hydrated;
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('http://127.0.0.1:3100/studio', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Forms', exact: true }).click();
    await page.getByRole('heading', { name: 'Forms', exact: true }).waitFor();
    await page.locator('a.explorer-recent').first().click();
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Form JSON' });
    await dialog.locator('.monaco-editor .view-lines').getByText('"name"', { exact: false }).first().waitFor();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    const smokePage = await page.request.post('http://127.0.0.1:3100/api/pages', { data: {
      name: 'Studio interaction smoke', route: '/studio-interaction-smoke',
      schema: { id: 'root', type: 'page', children: [
        { id: 'test-button', type: 'button', props: { label: 'Test action', events: {
          onclick: [{ type: 'message', title: 'Button action ran' }],
        } } },
        { id: 'test-input', type: 'textField', props: { label: 'Test value', events: {
          onchange: [{ type: 'message', title: 'New value {{event}}' }],
        } } },
        { id: 'test-table', type: 'dataTable', props: {
          columns: [{ key: 'name', label: 'Name' }], rows: [{ id: 'r1', name: 'Test record' }],
          events: { onrowclick: [{ type: 'message', title: 'Selected {{event.id}}' }] },
        } },
      ] },
    } });
    assert.ok(smokePage.ok(), await smokePage.text());
    const { data: artifact } = await smokePage.json();
    await page.goto(`http://127.0.0.1:3100/studio/pages/${artifact.id}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.palette-item').getByText('Data table', { exact: true }).hover();
    await page.locator('.component-preview').getByText('First record', { exact: true }).waitFor();
    const layers = page.locator('.layer-row');
    await layers.last().waitFor();
    const source = await layers.first().locator('.layer-grip').boundingBox();
    const target = await layers.last().boundingBox();
    assert.ok(source && target);
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height * 0.8, { steps: 8 });
    await page.mouse.up();
    await layers.last().getByRole('button', { name: 'button', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Appearance' }).click();
    await page.getByLabel('Padding (px)', { exact: true }).fill('24');
    const rendered = page.locator('.design-render').filter({ has: page.getByRole('button', { name: 'Test action', exact: true }) });
    assert.equal(await rendered.evaluate((element) => element.style.padding), '24px');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.locator('.page-preview__surface');
    await preview.getByRole('button', { name: 'Test action', exact: true }).click();
    await page.getByText('Button action ran', { exact: true }).waitFor();
    await preview.getByLabel('Test value', { exact: true }).fill('updated');
    await page.getByText('New value updated', { exact: true }).waitFor();
    await preview.getByText('Test record', { exact: true }).click();
    await page.getByText('Selected r1', { exact: true }).waitFor();
    assert.deepEqual(errors, [], 'Installed Studio has browser runtime exceptions.');
    await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading').first().waitFor();
    assert.deepEqual(errors, [], 'Installed web application has browser runtime exceptions.');
    console.log('[mosaic] installed consumer browser passed: login, Studio hydration, Monaco, palette preview, Layers drag, component appearance and events, and web rendering.');
    const service = spawn(process.execPath, ['build/index.js'], { cwd: join(app, 'apps', 'web'), env: { ...process.env, PORT: '3200', HOST: '127.0.0.1' }, detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    services.push(service);
    for (const stream of [service.stdout, service.stderr]) stream.on('data', (chunk) => { logs = (logs + chunk.toString()).slice(-60_000); });
    await waitHealthy('http://127.0.0.1:3200/api/health');
    await page.goto('http://127.0.0.1:3200/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading').first().waitFor();
    assert.deepEqual(errors, [], 'Production unified app has runtime exceptions.');
    console.log('[mosaic] production unified app passed: Node startup, same-origin API and database page rendering.');
  } finally { await browser.close(); }
} catch (error) { console.error(logs); throw error; }
finally {
  await writeFile(join(app, 'evidence', 'dev-startup.log'), logs);
  for (const service of services) {
    if (service.exitCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(service.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else process.kill(-service.pid, 'SIGTERM');
  }
}
if (!((await readdir(join(app, 'data'))).length)) throw new Error('Persistent data was not stored at project root.');
for (const target of ['netlify', 'vercel']) {
  run([npm, 'run', 'build', '-w', 'apps/web'], app, { ...process.env, MOSAIC_DEPLOY_TARGET: target });
}
console.log(`[mosaic] packed consumer passed: default CLI/Git/PWA, ignored secrets, install/migration, unified app/Studio checks, Node/Netlify/Vercel builds, persistent storage, browser/Monaco and same-origin API wiring. Evidence retained at ${directory}`);
