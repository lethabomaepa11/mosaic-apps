import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The same project template `mosaic create` scaffolds (templates/fullstack: one SvelteKit app
 * with the API at /api and Studio at /studio). Bundled at build time so the hosted Cloud does
 * not depend on a repository checkout at runtime; tests (plain Node) read it from disk.
 */
const SKIP = /(^|\/)(node_modules|\.svelte-kit|dist|build|pgdata|data)(\/|$)/;

function fromBundle(): Record<string, string> | null {
  try {
    const raw = import.meta.glob(['../../../../../templates/fullstack/**/*', '../../../../../templates/fullstack/**/.*', '!**/node_modules/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const files: Record<string, string> = {};
    for (const [path, content] of Object.entries(raw)) files[path.replace(/^.*?templates\/fullstack\//, '')] = content;
    return Object.keys(files).length ? files : null;
  } catch {
    return null; // not running under Vite
  }
}

function fromDisk(): Record<string, string> {
  const root = fileURLToPath(new URL('../../../../../templates/fullstack/', import.meta.url));
  const files: Record<string, string> = {};
  const walk = (relative: string) => {
    for (const name of readdirSync(join(root, relative))) {
      const path = relative ? `${relative}/${name}` : name;
      if (SKIP.test(path)) continue;
      if (statSync(join(root, path)).isDirectory()) walk(path);
      else files[path] = readFileSync(join(root, path), 'utf8');
    }
  };
  walk('');
  return files;
}

let cached: Record<string, string> | undefined;
export function templateFiles(): Record<string, string> {
  cached ??= fromBundle() ?? fromDisk();
  return cached;
}

/** Same token substitution and dotfile renames as the CLI's copyTemplate. */
export function renderTemplate(tokens: Record<string, string>): Array<{ path: string; content: string }> {
  return Object.entries(templateFiles())
    .filter(([path]) => !SKIP.test(path))
    .map(([path, raw]) => {
      let content = raw.replace(/\r\n/g, '\n');
      for (const [key, value] of Object.entries(tokens)) content = content.split(key).join(value);
      const renamed = path.replace(/(^|\/)gitignore$/, '$1.gitignore').replace(/(^|\/)gitattributes$/, '$1.gitattributes');
      return { path: renamed, content };
    });
}
