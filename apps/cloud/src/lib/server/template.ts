import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppFramework } from '../framework.ts';

/**
 * The same project template `mosaic create` scaffolds (templates/fullstack: one SvelteKit app
 * with the API at /api and Studio at /studio). Bundled at build time so the hosted Cloud does
 * not depend on a repository checkout at runtime; tests (plain Node) read it from disk.
 */
const SKIP = /(^|\/)(node_modules|\.svelte-kit|\.next|\.studio-build|_mosaic-studio|_mosaic-runtime|\.mosaic-data|\.vercel|\.git|dist|build|pgdata)(\/|$)|^(data|uploads|test)(\/|$)/;

// Bundle the file contents directly so Vite does not resolve the scaffold's TypeScript configs.
declare const __MOSAIC_TEMPLATE_FILES__: Record<AppFramework, Record<string, string>> | undefined;

function fromDisk(framework: AppFramework): Record<string, string> {
  const root = fileURLToPath(new URL(framework === 'nextjs' ? '../../../../../examples/nextjs/' : '../../../../../templates/fullstack/', import.meta.url));
  const files: Record<string, string> = {};
  const walk = (relative: string) => {
    for (const name of readdirSync(join(root, relative))) {
      const path = relative ? `${relative}/${name}` : name;
      if (SKIP.test(path) || name === '.npmrc' || (name.startsWith('.env') && name !== '.env.example')) continue;
      if (statSync(join(root, path)).isDirectory()) walk(path);
      else files[path] = readFileSync(join(root, path), 'utf8');
    }
  };
  walk('');
  return files;
}

const cached: Partial<Record<AppFramework, Record<string, string>>> = {};
export function templateFiles(framework: AppFramework): Record<string, string> {
  return cached[framework] ??= typeof __MOSAIC_TEMPLATE_FILES__ === 'undefined' ? fromDisk(framework) : __MOSAIC_TEMPLATE_FILES__[framework];
}

const versions: Partial<Record<AppFramework, string>> = {};

export function frameworkVersion(framework: AppFramework): string {
  const ordered = (files: Array<[string, string]>) => files.sort(([a], [b]) => a.localeCompare(b))
    .map(([path, content]) => [path, content.replace(/\r\n/g, '\n')]);
  return versions[framework] ??= createHash('sha256').update(JSON.stringify([
    // Increment when generation changes the scaffold independently of its source files.
    1, framework,
    ordered(Object.entries(templateFiles(framework))),
    ...(framework === 'nextjs' ? [ordered(Object.entries(templateFiles('sveltekit'))
      .filter(([path]) => /\/src\/(?:routes\/studio\/|lib\/studio\/|lib\/client\.ts$|app\.css$)|\/create-workflows\.js$/.test(path)))] : []),
  ])).digest('hex').slice(0, 16);
}

/** Same token substitution and dotfile renames as the CLI's copyTemplate. */
export function renderTemplate(tokens: Record<string, string>, framework: AppFramework): Array<{ path: string; content: string }> {
  return Object.entries(templateFiles(framework))
    .filter(([path]) => !SKIP.test(path))
    .map(([path, raw]) => {
      let content = raw.replace(/\r\n/g, '\n');
      for (const [key, value] of Object.entries(tokens)) content = content.split(key).join(value);
      const renamed = path.replace(/(^|\/)gitignore$/, '$1.gitignore').replace(/(^|\/)gitattributes$/, '$1.gitattributes');
      return { path: renamed, content };
    });
}
