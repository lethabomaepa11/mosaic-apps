import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { generateProjectFiles } from '../src/lib/server/generation';
import { tarGzip } from '../src/lib/server/archive';
import { decryptProviderSecret, encryptProviderSecret } from '../src/lib/server/providers';
import { compileSpec } from '../src/lib/server/spec';
import { equipmentSpec } from './fixtures/equipment-spec';

const project = () => generateProjectFiles({ name: 'Equipment Loans', slug: 'equipment-loans', spec: equipmentSpec, app: compileSpec(equipmentSpec) });

test('a release is the full mosaic create project: one app with the API and Studio built in', () => {
  const files = project();
  const paths = new Set(files.map((file) => file.path));
  for (const required of ['package.json', '.gitignore', 'AGENTS.md', '.agents/skills/mosaic-app/SKILL.md', 'apps/web/package.json', 'apps/web/src/routes/api/[...path]/+server.ts', 'apps/web/src/routes/studio/+layout.svelte']) {
    assert.ok(paths.has(required), required);
  }
  assert.ok(![...paths].some((path) => path.startsWith('apps/studio/')), 'Studio lives inside the web app');
  assert.ok(![...paths].some((path) => path.endsWith('gitignore') && !path.endsWith('.gitignore')));
  assert.equal(files.length, paths.size);
});

test('the generated entities replace the demo ones, and nothing is left unfilled', () => {
  const files = project();
  const entityFiles = files.filter((file) => file.path.startsWith('apps/web/src/lib/server/entities/')).map((file) => file.path.split('/').at(-1));
  assert.deepEqual(entityFiles.sort(), ['employee.entity.json', 'equipment.entity.json', 'loan.entity.json']);
  for (const file of files) assert.doesNotMatch(file.content, /__[A-Z_]+__/, `${file.path} still has a template placeholder`);
  assert.match(files.find((file) => file.path === 'apps/web/package.json')!.content, /"@equipment-loans\/web"/);
});

test('the app imports its generated pages and forms on first boot', () => {
  const files = project();
  const mosaic = files.find((file) => file.path === 'apps/web/src/lib/server/mosaic.ts')!.content;
  assert.match(mosaic, /createMosaicServerProvider\(\(\) => createMosaicServer\(\{/);
  assert.match(mosaic, /\}\)\.then\(importGeneratedApp\)\);/);
  const app = JSON.parse(files.find((file) => file.path === 'apps/web/src/lib/server/mosaic-app.json')!.content);
  assert.deepEqual(app.pages.map((page: { route: string }) => page.route), ['/', '/dashboard', '/equipment', '/employees', '/loans']);
  assert.ok(files.some((file) => file.path === 'apps/web/src/lib/server/import-generated.ts'));
});

test('release archive is a valid gzip-wrapped tar', () => {
  const archive = tarGzip([{ path: 'README.md', content: '# App\n' }]);
  assert.equal(archive[0], 0x1f); assert.equal(archive[1], 0x8b);
  const tar = gunzipSync(archive);
  assert.equal(tar.subarray(0, 9).toString(), 'README.md');
  assert.equal(tar.subarray(257, 262).toString(), 'ustar');
});

test('release archive stores long paths in the ustar prefix', () => {
  const path = `${'nested/'.repeat(20)}file.svelte`;
  const tar = gunzipSync(tarGzip([{ path, content: 'x' }]));
  const field = (start: number, end: number) => tar.subarray(start, end).toString().replace(/\0.*$/s, '');
  assert.equal(`${field(345, 500)}/${field(0, 100)}`, path);
});

test('provider credentials are encrypted and recoverable server-side', () => {
  const encrypted = encryptProviderSecret('provider-secret-value');
  assert.notEqual(encrypted.ciphertext, 'provider-secret-value');
  assert.equal(decryptProviderSecret(encrypted), 'provider-secret-value');
});
