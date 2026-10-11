/** `mosaic create <name>` — scaffold a full-stack Mosaic project. */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
  db?: string;
  auth: boolean;
  demo: boolean;
  pwa: boolean;
  apiPort: number;
  webPort: number;
  studioPort?: number;
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
  const databaseUrl = opts.db ?? 'pglite://./data';
  const studioPort = opts.studioPort ?? 3002;
  const ports = [opts.apiPort, opts.webPort, studioPort];
  if (ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535) || new Set(ports).size !== ports.length) {
    throw new Error('API, web and Studio ports must be different integers between 1 and 65535.');
  }
  if (opts.link && opts.npmMode) throw new Error('Choose either --link or --npm-mode.');
  if (opts.link && !existsSync(join(opts.link, 'packages', 'server', 'package.json'))) {
    throw new Error(`--link must point to a Mosaic source checkout: ${opts.link}`);
  }
  const jwtSecret = randomBytes(24).toString('hex');

  const templateDir = findTemplateDir(import.meta.url);
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
    __STUDIO_PORT__: String(studioPort),
    __DB_PORT__: String(opts.dbPort),
    __JWT_SECRET__: jwtSecret,
  });

  // .env with generated secret
  await writeEnv(target, databaseUrl, opts.apiPort, opts.webPort, studioPort, jwtSecret, opts.auth, opts.demo);

  // Published dependencies are the default; local links are explicit.
  if (opts.link) {
    await rewriteMosaicDeps(target, opts.link);
    console.log('🔗 Linked @mosaic-apps/* packages to the local repo checkout');
  }

  if (opts.pwa) {
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

  console.log(`
✅ ${name} is ready!

  cd ${slug}
  ${opts.install ? '' : `${opts.pm} install\n  `}${databaseUrl.startsWith('pglite') ? '# Embedded PostgreSQL: no database service needed' : '# Start the PostgreSQL service configured in DATABASE_URL'}
  npm run dev                   # API (:${opts.apiPort}) + web (:${opts.webPort}) + Studio (:${studioPort})

  API   → http://localhost:${opts.apiPort}
  Web   → http://localhost:${opts.webPort}
  Studio → http://localhost:${studioPort}
  Admin → admin@mosaic.local / admin1234${opts.demo ? '' : '\n\n  (demo seeding disabled)'}

Next:
  • mosaic entity Product --fields "name:string,price:decimal"   # model
  • npm run migrate                                              # migrate
  • mosaic studio                                                # design forms & pages
`);
}

async function writeEnv(target: string, db: string, port: number, webPort: number, studioPort: number, secret: string, auth: boolean, demo: boolean): Promise<void> {
  const env = `# Database
DATABASE_URL=${db}

# Auth
AUTH=${auth ? 'on' : 'off'}
MOSAIC_JWT_SECRET=${secret}

# Boot
PORT=${port}
MOSAIC_WEB_PORT=${webPort}
MOSAIC_STUDIO_PORT=${studioPort}
SEED=true
SEED_DEMO=${demo}

# Web/API topology
PUBLIC_API_URL=
CORS_ORIGINS=http://localhost:${webPort}
`;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(target, '.env'), env, 'utf8');
}

