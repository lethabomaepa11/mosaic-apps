import { cp, mkdir, rm, copyFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');
for (const [name, from] of [['fullstack', 'templates/fullstack'], ['nextjs', 'examples/nextjs']]) {
  const source = resolve(repositoryRoot, from);
  const destination = resolve(packageRoot, 'templates', name);
  if (!destination.startsWith(`${packageRoot}/`) && !destination.startsWith(`${packageRoot}\\`)) {
    throw new Error('Refusing to replace a path outside the CLI package directory.');
  }
  await mkdir(dirname(destination), { recursive: true });
  await rm(destination, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  await cp(source, destination, {
    recursive: true,
    filter: (path) => !/(^|[\\/])(node_modules|\.svelte-kit|\.next|\.mosaic-data|\.vercel|dist|build|pgdata|\.git|\.env(?!\.example)[^\\/]*)([\\/]|$)/.test(path)
      && !/^(data|uploads)([\\/]|$)/.test(relative(source, path)),
  });
  if (name === 'nextjs') await copyFile(resolve(source, '.gitignore'), resolve(destination, 'gitignore'));
  console.log(`[mosaic] bundled project template from ${source}`);
}
