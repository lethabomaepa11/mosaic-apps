import { spawnSync } from 'node:child_process';

const node = process.execPath;
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check through npm so npm_execpath is available.');
const packages = ['@mosaic-apps/core', '@mosaic-apps/server', '@mosaic-apps/ui', '@mosaic-apps/cli'];

for (const name of packages) {
  console.log(`\n[mosaic] checking npm tarball for ${name}`);
  const result = spawnSync(node, [npmCli, 'pack', '--dry-run', '--workspace', name], {
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (name === '@mosaic-apps/cli') {
    const cleanup = spawnSync(node, ['packages/cli/scripts/clean-template.mjs'], {
      stdio: 'inherit',
      shell: false,
    });
    if (cleanup.status !== 0) process.exit(cleanup.status ?? 1);
  }
}

console.log('\n[mosaic] all workspace packages passed pack lifecycle checks; nothing was published');
