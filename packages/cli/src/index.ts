#!/usr/bin/env node
/** mosaic CLI - scaffold, migrate, seed and drive Mosaic full-stack apps. */

import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { create } from './create.js';
import { info, studio, entity } from './commands-entity.js';
import { migrate as runMigrate, seed as runSeed } from './commands-migrate.js';
import { loadProjectConfig } from './project.js';

const HELP = `
mosaic — the metadata-driven full-stack platform

Usage: mosaic <command> [options]

Commands:
  create <name>          Scaffold a new Mosaic app (Hono API + SvelteKit PWA web)
  migrate                Plan + apply pending migrations (dry-run preview)
  seed [--demo]          Seed roles, settings, admin user (and demo data)
  entity <Name>          Scaffold an entity class in apps/api/src/entities
  dev                    Run the project's API + web apps together
  studio                 Open the Mosaic drag & drop studio against this project
  info                   Show project info (config + live server status)
  help                   Show this help

create options:
  --db <url>             Postgres connection string
                          (default pglite://./data, persistent embedded PostgreSQL)
  --auth on|off          Enable authentication (default on)
  --demo | --no-demo     Seed demo entities/forms (default demo)
  --pwa | --no-pwa       PWA-enabled web app (default pwa)
  --port <n>             API port (default 3001)
  --web-port <n>         Web port (default 3000)
  --studio-port <n>      Studio port (default 3002)
  --db-port <n>          Docker Postgres host port (default 5432)
  --pm npm|pnpm|yarn     Package manager (default npm)
  --install | --no-install   Run package install (default install)
  --git | --no-git       git init (default git)
  --link <path>          Link @mosaic-apps/* packages from a local repo checkout
  --npm-mode             Use published packages (the default; retained for compatibility)
  --force                Overwrite existing directory

entity options:
  --fields <spec>        "name:string,price:decimal,owner:ref:employee,active:boolean"
  --soft-delete          Enable soft delete (deletedAt)

Global:
  -C, --dir <path>       Run in another directory
  -h, --help             Show help
`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0] ?? 'help';

  if (command === 'help' || command === '--help' || command === '-h' || command === 'version' || command === '--version') {
    if (command === 'version' || command === '--version') {
      console.log('mosaic 0.2.3');
      return;
    }
    console.log(HELP);
    return;
  }

  const rest = argv.slice(1);

  switch (command) {
    case 'create':
    case 'new':
    case 'init': {
      const { values, positionals } = parseArgs({
        args: rest,
        options: {
          db: { type: 'string' },
          auth: { type: 'string', default: 'on' },
          demo: { type: 'boolean', default: true },
          'no-demo': { type: 'boolean', default: false },
          pwa: { type: 'boolean', default: true },
          'no-pwa': { type: 'boolean', default: false },
          port: { type: 'string', default: '3001' },
          'web-port': { type: 'string', default: '3000' },
          'studio-port': { type: 'string', default: '3002' },
          'db-port': { type: 'string', default: '5432' },
          pm: { type: 'string', default: 'npm' },
          install: { type: 'boolean', default: true },
          'no-install': { type: 'boolean', default: false },
          git: { type: 'boolean', default: true },
          'no-git': { type: 'boolean', default: false },
          link: { type: 'string' },
          'npm-mode': { type: 'boolean', default: false },
          force: { type: 'boolean', default: false },
          dir: { type: 'string', short: 'C' },
        },
        allowPositionals: true,
      });
      const name = positionals[0];
      if (!name) {
        console.error('Usage: mosaic create <name> [options]');
        process.exit(1);
      }
      await create({
        name,
        db: values.db,
        auth: values.auth === 'on' || values.auth === undefined,
        demo: Boolean(values.demo) && !values['no-demo'],
        pwa: Boolean(values.pwa) && !values['no-pwa'],
        apiPort: Number(values.port),
        webPort: Number(values['web-port']),
        studioPort: Number(values['studio-port']),
        dbPort: Number(values['db-port']),
        pm: values.pm as 'npm' | 'pnpm' | 'yarn',
        install: Boolean(values.install) && !values['no-install'],
        git: Boolean(values.git) && !values['no-git'],
        link: values.link,
        npmMode: values['npm-mode'],
        force: values.force,
        cwd: values.dir ?? process.cwd(),
      });
      return;
    }
    case 'migrate':
    case 'seed':
    case 'entity':
    case 'info':
    case 'studio':
    case 'dev': {
      const { values, positionals } = parseArgs({
        args: rest,
        options: {
          dir: { type: 'string', short: 'C' },
          demo: { type: 'boolean', default: false },
          fields: { type: 'string' },
          'soft-delete': { type: 'boolean', default: false },
          'allow-destructive': { type: 'boolean', default: true },
          'dry-run': { type: 'boolean', default: false },
          port: { type: 'string' },
        },
        allowPositionals: true,
      });
      const dir = values.dir ?? process.cwd();
      if (command === 'migrate') {
        await runMigrate({ dir, allowDestructive: values['allow-destructive'], dryRun: values['dry-run'] });
      } else if (command === 'seed') {
        await runSeed({ dir, demo: values.demo });
      } else if (command === 'entity') {
        const entityName = positionals[0];
        if (!entityName) {
          console.error('Usage: mosaic entity <Name> --fields "name:string,price:decimal"');
          process.exit(1);
        }
        await entity({ dir, name: entityName, fields: values.fields, softDelete: values['soft-delete'] });
      } else if (command === 'info') {
        await info({ dir });
      } else if (command === 'studio') {
        await studio({ dir, port: values.port ? Number(values.port) : undefined });
      } else {
        await loadProjectConfig(dir); // validates we're in a project
        const child = spawn('npm', ['run', 'dev'], {
          cwd: dir,
          stdio: 'inherit',
          shell: process.platform === 'win32',
        });
        child.on('exit', (code) => process.exit(code ?? 0));
      }
      return;
    }
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('[mosaic] error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

