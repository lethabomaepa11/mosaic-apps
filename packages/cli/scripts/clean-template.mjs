import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const name of ['fullstack', 'nextjs']) {
  const destination = resolve(packageRoot, 'templates', name);
  if (!destination.startsWith(`${packageRoot}/`) && !destination.startsWith(`${packageRoot}\\`)) {
    throw new Error('Refusing to remove a path outside the CLI package directory.');
  }
  await rm(destination, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
}
console.log('[mosaic] removed generated template copy');
