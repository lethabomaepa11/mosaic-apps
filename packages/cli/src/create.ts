/** `mosaic create <name>` — scaffold a full-stack Mosaic project. */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import {
  copyTemplate,
  ensureDir,
  findTemplateDir,
  removeDir,
  rewriteMosaicDeps,
  run,
  slugify,
  titleCase,
} from './project.js';

export interface CreateOptions {
  name: string;
  framework?: 'sveltekit' | 'nextjs';
  db?: string;
  auth: boolean;
  demo: boolean;
  pwa: boolean;
  apiPort: number;
  webPort: number;
  dbPort: number;
  pm: 'npm' | 'pnpm' | 'yarn';
  install: boolean;
  git: boolean;
  link?: string;
  npmMode: boolean;
  force: boolean;
  cwd: string;
}

export async function create(opts: CreateOptions): Promise<void> {
  const name = titleCase(opts.name);
  const slug = slugify(opts.name);
  const target = join(opts.cwd, slug);
  const next = opts.framework === 'nextjs';
  const databaseUrl = opts.db ?? 'pglite://./data';
  const ports = [opts.apiPort, opts.webPort];
  if (ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535) || new Set(ports).size !== ports.length) {
    throw new Error('API and web ports must be different integers between 1 and 65535.');
  }
  if (opts.link && opts.npmMode) throw new Error('Choose either --link or --npm-mode.');
  if (opts.link && !existsSync(join(opts.link, 'packages', 'server', 'package.json'))) {
    throw new Error(`--link must point to a Mosaic source checkout: ${opts.link}`);
  }
  const jwtSecret = randomBytes(24).toString('hex');

  const templateDir = findTemplateDir(import.meta.url, opts.framework);
  if (!templateDir) {
    console.error(
      'Could not locate the Mosaic template. Run the CLI from the mosaic-apps repo checkout,\n' +
        'or reinstall @mosaic-apps/cli (templates are bundled with the published package).',
    );
    process.exit(1);
  }

  if (existsSync(target)) {
    if (!opts.force) {
      console.error(`Directory "${slug}" already exists. Use --force to overwrite.`);
      process.exit(1);
    }
    await removeDir(target);
  }
  await ensureDir(target);

  console.log(`\n▦ Creating Mosaic project "${name}" in ${target}\n`);

  await copyTemplate(templateDir, target, {
    __PROJECT_NAME__: name,
    __PROJECT_SLUG__: slug,
    __DB_URL__: databaseUrl,
    __AUTH__: String(opts.auth),
    __PWA__: String(opts.pwa),
    __DEMO__: String(opts.demo),
    __API_PORT__: String(opts.apiPort),
    __WEB_PORT__: String(opts.webPort),
    __DB_PORT__: String(opts.dbPort),
    __JWT_SECRET__: jwtSecret,
  });

  // .env with generated secret
  await writeEnv(target, databaseUrl, opts.webPort, jwtSecret, opts.auth, opts.demo);
  if (next) {
    const manifestPath = join(target, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.name = slug;
    manifest.scripts.dev = `next dev --port ${opts.webPort}`;
    manifest.scripts.start = `next start --port ${opts.webPort}`;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const lockPath = join(target, 'package-lock.json');
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    lock.name = lock.packages[''].name = slug;
    await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
    await writeFile(join(target, 'mosaic.config.json'), JSON.stringify({
      name, slug, framework: 'nextjs', auth: opts.auth, demo: opts.demo, pwa: false,
      api: { port: opts.webPort }, web: { port: opts.webPort },
    }, null, 2) + '\n');
  }

  // Published dependencies are the default; local links are explicit.
  if (opts.link) {
    await rewriteMosaicDeps(target, opts.link);
    console.log('🔗 Linked @mosaic-apps/* packages to the local repo checkout');
  }

  if (opts.pwa && !next) {
    run(process.execPath, [join(target, 'apps', 'web', 'scripts', 'make-icons.mjs')], target);
    console.log('📱 PWA icons generated');
  }

  if (opts.git) {
    try {
      run('git', ['init', '-q'], target);
      run('git', ['-c', 'core.autocrlf=false', 'add', '-A'], target);
      run('git', ['-c', 'user.name=mosaic', '-c', 'user.email=mosaic@local', 'commit', '-qm', 'chore: scaffold Mosaic project'], target);
      console.log('🌱 Git repository initialised');
    } catch (error) {
      console.warn(`Git initialization failed: ${error instanceof Error ? error.message : error}. Project creation will continue.`);
    }
  }

  if (opts.install) {
    console.log(`\n📦 Installing dependencies with ${opts.pm}…\n`);
    run(opts.pm, ['install'], target);
    // npm 11 gates install scripts — approve esbuild (needed by tsx) when present
    try {
      run('npm', ['install-scripts', 'approve', 'esbuild'], target);
    } catch {
      /* ignore when unsupported */
    }
  }

  if (next) {
    console.log(`\n${name} is ready. Run ${opts.install ? '' : `${opts.pm} install, then `}${opts.pm} run dev in ${slug}.\nApp and API at http://localhost:${opts.webPort}. See README.md for database and sign-in setup.`);
    return;
  }

  console.log(`
✅ ${name} is ready!

  cd ${slug}
  ${opts.install ? '' : `${opts.pm} install\n  `}${databaseUrl.startsWith('pglite') ? '# Embedded PostgreSQL: no database service needed' : '# Start the PostgreSQL service configured in DATABASE_URL'}
  npm run dev                   # one server: app + /api + /studio on :${opts.webPort}

  App    → http://localhost:${opts.webPort}
  API    → http://localhost:${opts.webPort}/api
  Studio → http://localhost:${opts.webPort}/studio
  Admin  → admin@mosaic.local / admin1234${opts.demo ? '' : '\n\n  (demo seeding disabled)'}

Next:
  • mosaic entity Product --fields "name:string,price:decimal"   # model
  • npm run migrate                                              # migrate
  • open /studio                                                 # design forms & pages
`);
}

async function writeEnv(target: string, db: string, webPort: number, secret: string, auth: boolean, demo: boolean): Promise<void> {
  const env = `# Database
DATABASE_URL=${db}

# Auth
AUTH=${auth ? 'on' : 'off'}
MOSAIC_JWT_SECRET=${secret}

# Boot
MOSAIC_WEB_PORT=${webPort}
SEED=true
SEED_DEMO=${demo}
`;
  await writeFile(join(target, '.env'), env, 'utf8');
}

