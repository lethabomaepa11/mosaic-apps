import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { create, type CreateOptions } from './create.js';
import { findRepoRoot, loadProjectConfig, loadProjectEnvironment } from './project.js';

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'mosaic cli regression '));
  t.after(async () => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    await rm(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  });
  return root;
}

function options(cwd: string, extra: Partial<CreateOptions> = {}): CreateOptions {
  return { name: 'My CRM', cwd, auth: true, demo: true, pwa: true, apiPort: 3001, webPort: 3000, dbPort: 5432,
    pm: 'npm', install: false, git: true, npmMode: false, force: false, ...extra };
}

test('plain create works with spaces, commits one message and ignores secrets and persistent data', async (t) => {
  const root = await fixture(t);
  await create(options(root));
  const app = join(root, 'my-crm');
  const env = await readFile(join(app, '.env'), 'utf8');
  assert.match(env, /^DATABASE_URL=pglite:\/\/\.\/data$/m);
  assert.ok(existsSync(join(app, '.gitignore')));
  assert.ok(existsSync(join(app, '.gitattributes')));
  const commit = spawnSync('git', ['log', '-1', '--format=%s'], { cwd: app, encoding: 'utf8', shell: false });
  assert.equal(commit.status, 0);
  assert.equal(commit.stdout.trim(), 'chore: scaffold Mosaic project');
  const tracked = spawnSync('git', ['ls-files'], { cwd: app, encoding: 'utf8', shell: false });
  assert.ok(!tracked.stdout.split(/\r?\n/).includes('.env'));
  const ignored = spawnSync('git', ['check-ignore', '.env', 'data/db', 'uploads/logo.png'], { cwd: app, encoding: 'utf8', shell: false });
  assert.equal(ignored.status, 0);
  for (const path of ['package.json', 'apps/api/package.json', 'apps/web/package.json', 'apps/studio/package.json']) {
    assert.doesNotMatch(await readFile(join(app, path), 'utf8'), /file:/);
  }
  assert.doesNotMatch(await readFile(join(app, 'apps/studio/vite.config.ts'), 'utf8'), /__\w+__/);
  for (const name of ['web', 'studio']) {
    assert.match(await readFile(join(app, `apps/${name}/vite.config.ts`), 'utf8'), /exclude: \['@mosaic-apps\/ui'\]/);
  }
});

test('no-demo, custom ports and explicit PostgreSQL are honored', async (t) => {
  const root = await fixture(t);
  await create(options(root, { db: 'postgres://mosaic:mosaic@127.0.0.1:5433/my-crm', demo: false, git: false, pwa: false,
    apiPort: 3101, webPort: 3100, studioPort: 3102 }));
  const app = join(root, 'my-crm');
  assert.match(await readFile(join(app, '.env'), 'utf8'), /^SEED_DEMO=false$/m);
  const config = await loadProjectConfig(app);
  assert.equal(config.api.port, 3101);
  assert.equal(config.web.port, 3100);
  assert.equal(config.studio?.port, 3102);
  assert.match(config.databaseUrl, /^postgres:/);
});

test('published template is not mistaken for a source checkout', async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, 'templates/fullstack'), { recursive: true });
  await writeFile(join(root, 'templates/fullstack/package.json'), '{}');
  assert.equal(findRepoRoot(root), null);
});

test('CLI reads .env and resolves embedded data relative to the project', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'mosaic.config.json'), JSON.stringify({ databaseUrl: 'postgres://unused/old', api: { port: 9999 } }));
  await writeFile(join(root, '.env'), 'DATABASE_URL=pglite://./data\nPORT=3101\nMOSAIC_WEB_PORT=3100\nMOSAIC_STUDIO_PORT=3102\n');
  const config = await loadProjectConfig(root);
  assert.equal(config.databaseUrl, `pglite://${resolve(root, 'data')}`);
  assert.equal(config.api.port, 3101);
});

test('invalid or duplicate ports fail before writing a project', async (t) => {
  const root = await fixture(t);
  await assert.rejects(create(options(root, { apiPort: 3000 })), /ports must be different/);
  assert.equal(existsSync(join(root, 'my-crm')), false);
});

test('administrator bootstrap configuration is read without overwriting the process environment', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, '.env'), 'ADMIN_EMAIL=owner@example.test\nADMIN_PASSWORD=local-test-bootstrap-only\n');
  const before = process.env.ADMIN_EMAIL;
  const values = await loadProjectEnvironment(root);
  assert.equal(values.ADMIN_EMAIL, before ?? 'owner@example.test');
  assert.equal(process.env.ADMIN_EMAIL, before);
});
