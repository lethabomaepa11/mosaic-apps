import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');
const source = resolve(repositoryRoot, 'templates/fullstack');
const destination = resolve(packageRoot, 'templates/fullstack');
if (!destination.startsWith(`${packageRoot}/`) && !destination.startsWith(`${packageRoot}\\`)) {
  throw new Error('Refusing to replace a path outside the CLI package directory.');
}

await mkdir(dirname(destination), { recursive: true });
await rm(destination, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
await cp(source, destination, {
  recursive: true,
  filter: (path) => !/(^|[\\/])(node_modules|\.svelte-kit|dist|build|pgdata|\.git)([\\/]|$)/.test(path),
});
console.log(`[mosaic] bundled project template from ${source}`);
