import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run release:consumer:pack.');
const directory = resolve('.tmp-generated/browser-smoke');
await mkdir(directory, { recursive: true });
for (const name of ['core', 'server', 'ui', 'cli']) {
  const result = spawnSync(process.execPath, [npm, 'pack', '-w', `@mosaic-apps/${name}`, '--pack-destination', directory], { stdio: 'inherit', windowsHide: true, shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
