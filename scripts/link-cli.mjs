#!/usr/bin/env node
/**
 * Build @mosaic/cli and link its `mosaic` bin globally so apps can be created
 * from any directory without publishing to npm first.
 *
 *   npm run link-cli
 *   mosaic create my-app --link C:/path/to/mosaic-apps
 *
 * Undo with: npm unlink -g @mosaic/cli
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const cliDir = join(repo, 'packages', 'mosaic-cli');

function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

run('npm', ['run', 'build', '-w', '@mosaic/cli'], repo);
run('npm', ['link'], cliDir);

console.log('\n✓ `mosaic` now points at packages/mosaic-cli/dist/index.js');
console.log('  templates are resolved from this checkout, so `mosaic create <name>`');
console.log('  scaffolds projects with file: links to your local @mosaic/* packages.');
console.log('  Remove with: npm unlink -g @mosaic/cli');
