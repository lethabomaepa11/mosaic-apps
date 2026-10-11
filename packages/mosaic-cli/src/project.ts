/** Project + template utilities for the Mosaic CLI (part 1). */

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'mosaic-app';
}

export function titleCase(input: string): string {
  return input
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join(' ');
}

/** Walk up from a start dir until `templates/fullstack/package.json` exists. */
export function findRepoRoot(start: string): string | null {
  let dir = resolve(start);
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'templates', 'fullstack', 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function findTemplateDir(cliFileUrl: string): string | null {
  const fromCli = dirname(fileURLToPath(cliFileUrl));
  const repo = findRepoRoot(fromCli);
  if (repo) return join(repo, 'templates', 'fullstack');
  const bundled = join(fromCli, '..', 'templates', 'fullstack');
  if (existsSync(join(bundled, 'package.json'))) return bundled;
  return null;
}

/**
 * Entity directories of a project, in precedence order (last wins).
 *
 * Modern projects keep entity classes in `apps/api/src/entities`; projects
 * scaffolded before classes existed used `apps/api/entities`.
 */
export function entitiesDirsOf(dir: string): string[] {
  const legacy = join(dir, 'apps', 'api', 'entities');
  const modern = join(dir, 'apps', 'api', 'src', 'entities');
  const found = [legacy, modern].filter((path) => existsSync(path));
  return found.length ? found : [modern];
}

/** The directory new entity files are written to. */
export function entitiesDirOf(dir: string): string {
  const dirs = entitiesDirsOf(dir);
  return dirs[dirs.length - 1]!;
}

export interface ProjectConfig {
  name: string;
  slug: string;
  databaseUrl: string;
  auth: boolean;
  pwa: boolean;
  demo: boolean;
  api: { port: number };
  web: { port: number };
}

export async function loadProjectConfig(dir: string): Promise<ProjectConfig> {
  const file = join(dir, 'mosaic.config.json');
  if (!existsSync(file)) {
    throw new Error('No mosaic.config.json found — run this command inside a Mosaic project.');
  }
  const raw = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  const api = (raw.api ?? {}) as { port?: number };
  const web = (raw.web ?? {}) as { port?: number };
  return {
    name: String(raw.name ?? 'Mosaic app'),
    slug: String(raw.slug ?? slugify(String(raw.name ?? 'app'))),
    databaseUrl: process.env.DATABASE_URL ?? String(raw.databaseUrl ?? 'postgres://mosaic:mosaic@localhost:5432/mosaic'),
    auth: raw.auth !== false,
    pwa: raw.pwa !== false,
    demo: raw.demo !== false,
    api: { port: Number(process.env.PORT ?? api.port ?? 8787) },
    web: { port: web.port ?? 5173 },
  };
}

const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.webp', '.zip']);

/** Recursively copy a template tree, replacing tokens in text files. */
export async function copyTemplate(
  templateDir: string,
  targetDir: string,
  tokens: Record<string, string>,
): Promise<number> {
  let files = 0;
  const walk = async (relative: string): Promise<void> => {
    const src = join(templateDir, relative);
    const entries = await readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.svelte-kit' || entry.name === 'dist' || entry.name === 'build' || entry.name === 'pgdata') continue;
      const rel = relative ? join(relative, entry.name) : entry.name;
      const dest = join(targetDir, rel);
      if (entry.isDirectory()) {
        await mkdir(dest, { recursive: true });
        await walk(rel);
      } else {
        const buf = await readFile(join(templateDir, rel));
        const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
        if (BINARY_EXT.has(ext)) {
          await writeFile(dest, buf);
        } else {
          let text = buf.toString('utf8');
          for (const [key, value] of Object.entries(tokens)) {
            text = text.split(key).join(value);
          }
          await writeFile(dest, text, 'utf8');
        }
        files++;
      }
    }
  };
  await mkdir(targetDir, { recursive: true });
  await walk('');
  return files;
}

/** Rewrite @mosaic-apps/mosaic-* deps to file: links (link mode). */
export async function rewriteMosaicDeps(dir: string, linkDir: string): Promise<void> {
  const packages = join(linkDir, 'packages');
  const files: string[] = [];
  const walk = async (relative: string): Promise<void> => {
    const src = join(dir, relative);
    for (const entry of await readdir(src, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.svelte-kit' || entry.name === 'dist') continue;
      const rel = relative ? join(relative, entry.name) : entry.name;
      if (entry.isDirectory()) await walk(rel);
      else if (entry.name === 'package.json') files.push(join(dir, rel));
    }
  };
  await walk('');
  for (const file of files) {
    const raw = JSON.parse(await readFile(file, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    let changed = false;
    for (const section of ['dependencies', 'devDependencies'] as const) {
      const deps = raw[section];
      if (!deps) continue;
      for (const name of Object.keys(deps)) {
        if (!name.startsWith('@mosaic-apps/mosaic-')) continue;
        const short = name.replace('@mosaic-apps/mosaic-', '');
        const abs = join(packages, `mosaic-${short}`);
        if (existsSync(abs)) {
          deps[name] = `file:${abs.split('\\').join('/')}`;
          changed = true;
        }
      }
    }
    if (changed) await writeFile(file, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  }
}

export function run(cmd: string, args: string[], cwd: string): void {
  const cmdLine = process.platform === 'win32' && /\s/.test(cmd) ? `"${cmd}"` : cmd;
  const res = spawnSync(cmdLine, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (exit ${res.status})`);
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function removeDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

