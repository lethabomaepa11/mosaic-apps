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
  assert.ok(existsSync(join(app, 'AGENTS.md')));
  assert.ok(existsSync(join(app, 'apps/web/src/routes/api/[...path]/+server.ts')));
  assert.ok(existsSync(join(app, 'apps/web/src/routes/(app)/[...route]/+page.server.ts')));
  assert.doesNotMatch(await readFile(join(app, 'apps/web/vite.config.ts'), 'utf8'), /proxy:/);
  assert.match(await readFile(join(app, 'apps/web/package.json'), 'utf8'), /@mosaic-apps\/sveltekit/);
  assert.match(
    await readFile(join(app, '.agents/skills/mosaic-app/SKILL.md'), 'utf8'),
    /^name: mosaic-app$/m,
  );
  const commit = spawnSync('git', ['log', '-1', '--format=%s'], { cwd: app, encoding: 'utf8', shell: false });
  assert.equal(commit.status, 0);
  assert.equal(commit.stdout.trim(), 'chore: scaffold Mosaic project');
  const tracked = spawnSync('git', ['ls-files'], { cwd: app, encoding: 'utf8', shell: false });
  assert.ok(!tracked.stdout.split(/\r?\n/).includes('.env'));
  const ignored = spawnSync('git', ['check-ignore', '.env', 'data/db', 'uploads/logo.png'], { cwd: app, encoding: 'utf8', shell: false });
  assert.equal(ignored.status, 0);
  for (const path of ['package.json', 'apps/web/package.json']) {
    assert.doesNotMatch(await readFile(join(app, path), 'utf8'), /file:/);
  }
  // Studio is part of the one web app, served at /studio.
  assert.equal(existsSync(join(app, 'apps/studio')), false);
  assert.ok(existsSync(join(app, 'apps/web/src/routes/studio/+layout.svelte')));
  assert.ok(existsSync(join(app, 'apps/web/src/routes/(app)/+layout.svelte')));
  for (const path of ['apps/web/vite.config.ts', 'mosaic.config.json', '.env', '.env.example', 'README.md']) {
    assert.doesNotMatch(await readFile(join(app, path), 'utf8'), /__\w+__|STUDIO_PORT/, path);
  }
  assert.match(await readFile(join(app, 'apps/web/vite.config.ts'), 'utf8'), /exclude: \['@mosaic-apps\/ui'\]/);
  assert.match(await readFile(join(app, 'apps/web/package.json'), 'utf8'), /monaco-editor/);
});

test('no-demo, custom ports and explicit PostgreSQL are honored', async (t) => {
  const root = await fixture(t);
  await create(options(root, { db: 'postgres://mosaic:mosaic@127.0.0.1:5433/my-crm', demo: false, git: false, pwa: false,
    apiPort: 3101, webPort: 3100 }));
  const app = join(root, 'my-crm');
  assert.match(await readFile(join(app, '.env'), 'utf8'), /^SEED_DEMO=false$/m);
  const config = await loadProjectConfig(app);
  assert.equal(config.api.port, 3101);
  assert.equal(config.web.port, 3100);
  assert.match(config.databaseUrl, /^postgres:/);
});

test('published template is not mistaken for a source checkout', async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, 'templates/fullstack'), { recursive: true });
  await writeFile(join(root, 'templates/fullstack/package.json'), '{}');
  assert.equal(findRepoRoot(root), null);
});

test('Next.js scaffold keeps its lockfile, same-origin API, and deployment environment private', async (t) => {
  const root = await fixture(t);
  await create(options(root, { framework: 'nextjs', webPort: 3210 }));
  const app = join(root, 'my-crm');
  const manifest = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(app, 'package-lock.json'), 'utf8'));
  assert.equal(manifest.name, 'my-crm');
  assert.equal(manifest.scripts.dev, 'npm run build:studio && next dev --port 3210');
  assert.equal(lock.packages[''].name, manifest.name);
  assert.equal((await loadProjectConfig(app)).web.port, 3210);
  assert.ok(existsSync(join(app, 'app/api/[...path]/route.js')));
  assert.ok(existsSync(join(app, 'app/[...path]/page.jsx')));
  assert.ok(!existsSync(join(app, '.next')));
  assert.ok(existsSync(join(app, 'studio-source/routes/studio/forms/[id]/+page.svelte')));
  assert.ok(!existsSync(join(app, '.studio-build')));
  const ignored = spawnSync('git', ['check-ignore', '.env', 'data/db', 'uploads/image.png'], { cwd: app, encoding: 'utf8' });
  assert.equal(ignored.status, 0);
});

test('link mode installs source UI dependencies in the generated app', async (t) => {
  const root = await fixture(t);
  const link = resolve(import.meta.dirname, '../../..');
  await create(options(root, { link, git: false, pwa: false }));
  const { dependencies } = JSON.parse(await readFile(join(root, 'my-crm/apps/web/package.json'), 'utf8'));
  const ui = JSON.parse(await readFile(join(link, 'packages/ui/package.json'), 'utf8'));
  assert.match(dependencies['@mosaic-apps/ui'], /^file:/);
  assert.equal(dependencies['tailwind-merge'], ui.dependencies['tailwind-merge']);
  assert.equal(dependencies['svelte-sonner'], ui.dependencies['svelte-sonner']);
});

test('CLI reads .env and resolves embedded data relative to the project', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'mosaic.config.json'), JSON.stringify({ databaseUrl: 'postgres://unused/old', api: { port: 9999 } }));
  await writeFile(join(root, '.env'), 'DATABASE_URL=pglite://./data\nPORT=3101\nMOSAIC_WEB_PORT=3100\n');
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
