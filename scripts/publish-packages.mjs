import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run release:publish.');
for (const directory of ['core', 'server', 'ui', 'cli']) {
  const { name, version } = JSON.parse(await readFile(new URL(`../packages/${directory}/package.json`, import.meta.url), 'utf8'));
  const lookup = spawnSync(process.execPath, [npm, 'view', `${name}@${version}`, 'version', '--json'], { encoding: 'utf8', windowsHide: true });
  if (lookup.status === 0 && JSON.parse(lookup.stdout) === version) {
    console.log(`[mosaic] ${name}@${version} is already published; skipping`);
    continue;
  }
  let code;
  try { code = JSON.parse(lookup.stdout).error?.code; } catch { /* A non-JSON response is a registry failure. */ }
  if (code !== 'E404') throw new Error(`Cannot determine registry state for ${name}@${version}: ${lookup.stderr || lookup.stdout}`);
  console.log(`[mosaic] publishing ${name}@${version}`);
  const publish = spawnSync(process.execPath, [npm, 'publish', '--workspace', name, '--access', 'public'], { stdio: 'inherit', windowsHide: true });
  if (publish.status !== 0) process.exit(publish.status ?? 1);
}
