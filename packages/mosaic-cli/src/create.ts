/** `mosaic create <name>` — scaffold a full-stack Mosaic project. */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import {
  copyTemplate,
  ensureDir,
  findRepoRoot,
  findTemplateDir,
  removeDir,
  rewriteMosaicDeps,
  run,
  slugify,
  titleCase,
} from './project.js';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CreateOptions {
  name: string;
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
  const databaseUrl = opts.db ?? `postgres://mosaic:mosaic@localhost:${opts.dbPort}/${slug}`;
  const jwtSecret = randomBytes(24).toString('hex');

  const templateDir = findTemplateDir(import.meta.url);
  if (!templateDir) {
    console.error(
      'Could not locate the Mosaic template. Run the CLI from the mosaic-apps repo checkout,\n' +
        'or reinstall @mosaic/cli (templates are bundled with the published package).',
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

  const files = await copyTemplate(templateDir, target, {
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
  await writeEnv(target, databaseUrl, opts.apiPort, opts.webPort, jwtSecret, opts.auth);

  // link @mosaic packages
  let linkDir: string | null = null;
  if (!opts.npmMode) {
    linkDir = opts.link && existsSync(opts.link) ? opts.link : findRepoRoot(dirname(fileURLToPath(import.meta.url)));
    if (linkDir) {
      await rewriteMosaicDeps(target, linkDir);
      console.log('🔗 Linked @mosaic/* packages to the local repo checkout');
    } else if (opts.link) {
      console.warn(`⚠ --link path not found: ${opts.link}`);
    }
  }

  if (opts.pwa) {
    run(process.execPath, [join(target, 'apps', 'web', 'scripts', 'make-icons.mjs')], target);
    console.log('📱 PWA icons generated');
  }

  if (opts.git) {
    run('git', ['init', '-q'], target);
    run('git', ['add', '-A'], target);
    run('git', ['-c', 'user.name=mosaic', '-c', 'user.email=mosaic@local', 'commit', '-qm', 'chore: scaffold Mosaic project'], target);
    console.log('🌱 Git repository initialised');
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
  ${opts.install ? '' : `${opts.pm} install\n`}docker compose up -d        # start PostgreSQL
  npm run dev                   # API (:${opts.apiPort}) + web (:${opts.webPort})

  API   → http://localhost:${opts.apiPort}
  Web   → http://localhost:${opts.webPort}
  Admin → admin@mosaic.local / admin1234${opts.demo ? '' : '\n\n  (demo seeding disabled)'}

Next:
  • mosaic entity Product --fields "name:string,price:decimal"   # model
  • npm run migrate                                              # migrate
  • mosaic studio                                                # design forms & pages
`);
}

async function writeEnv(target: string, db: string, port: number, webPort: number, secret: string, auth: boolean): Promise<void> {
  const env = `# Database
DATABASE_URL=${db}

# Auth
AUTH=${auth ? 'on' : 'off'}
MOSAIC_JWT_SECRET=${secret}

# Boot
PORT=${port}
SEED=true
SEED_DEMO=true

# Web/API topology
PUBLIC_API_URL=
CORS_ORIGINS=http://localhost:${webPort}
`;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(target, '.env'), env, 'utf8');
}
