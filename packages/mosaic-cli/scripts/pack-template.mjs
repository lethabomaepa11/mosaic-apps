import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');
const source = resolve(repositoryRoot, 'templates/fullstack');
const destination = resolve(packageRoot, 'templates/fullstack');

await mkdir(dirname(destination), { recursive: true });
await rm(destination, { recursive: true, force: true });
await cp(source, destination, {
  recursive: true,
  filter: (path) => !/(^|[\\/])(node_modules|\.svelte-kit|dist|build|pgdata|\.git)([\\/]|$)/.test(path),
});
console.log(`[mosaic] bundled project template from ${source}`);
