import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { generateProjectFiles } from '../src/lib/server/generation';
import { tarGzip } from '../src/lib/server/archive';
import { decryptProviderSecret, encryptProviderSecret } from '../src/lib/server/providers';
import { autoRepair, compileSpec, normalizeSpec, validateSpec } from '../src/lib/server/spec';
import { verifyApp } from '../src/lib/server/mosaic-runtime';
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

test('a Vercel install can load the generated Vite config from the web workspace alone', () => {
  const files = project();
  const config = files.find((file) => file.path === 'apps/web/vite.config.ts');
  assert.match(config!.content, /from '\.\/scripts\/vercel-adapter\.ts'/);
  assert.ok(files.some((file) => file.path === 'apps/web/scripts/vercel-adapter.ts'));
});

test('the app imports its generated pages and forms on first boot', () => {
  const files = project();
  const mosaic = files.find((file) => file.path === 'apps/web/src/lib/server/mosaic.ts')!.content;
  assert.match(mosaic, /createMosaicServerProvider\(\(\) => createMosaicServer\(\{/);
  assert.match(mosaic, /\}\)\.then\(importGeneratedApp\)\);/);
  const app = JSON.parse(files.find((file) => file.path === 'apps/web/src/lib/server/mosaic-app.json')!.content);
  assert.deepEqual(app.pages.map((page: { route: string }) => page.route), ['/', '/dashboard', '/equipment', '/employees', '/loans', '/login']);
  assert.ok(files.some((file) => file.path === 'apps/web/src/lib/server/import-generated.ts'));
});

test('a managed leave submission generates backend code and an OpenAPI contract from the same form', async () => {
  const { spec } = autoRepair(normalizeSpec({
    name: 'LeaveDesk', roles: ['viewer'],
    entities: [
      { name: 'organization', label: 'Organization', labelPlural: 'Organizations', fields: [{ name: 'name', required: true }] },
      { name: 'employee', label: 'Employee', labelPlural: 'Employees', fields: [
        { name: 'name', required: true }, { name: 'email', format: 'email', required: true, unique: true },
        { name: 'organization', type: 'ref', refEntity: 'organization', required: true },
      ] },
      { name: 'leave_request', label: 'Leave request', labelPlural: 'Leave requests', permissions: { create: ['viewer'] }, fields: [
        { name: 'reason', required: true }, { name: 'startDate', type: 'date', required: true },
        { name: 'employee', type: 'ref', refEntity: 'employee', required: true },
        { name: 'organization', type: 'ref', refEntity: 'organization', required: true },
        { name: 'status', type: 'enum', required: true, options: ['Pending Approval', 'Approved'] },
      ], submission: { profile: { entity: 'employee', emailField: 'email' }, managed: [
        { field: 'employee', source: 'profile', value: 'id' },
        { field: 'organization', source: 'profile', value: 'organization' },
        { field: 'status', source: 'constant', value: 'Pending Approval' },
      ] } },
    ],
    sampleData: [
      { entity: 'organization', records: [{ name: 'Summit' }] },
      { entity: 'employee', records: [{ name: 'Thandi', email: 'thandi@example.com', organization: 'Summit' }] },
      { entity: 'leave_request', records: [{ reason: 'Holiday', startDate: '2026-12-01', employee: 'Thandi', organization: 'Summit', status: 'Pending Approval' }] },
    ],
  }));
  assert.deepEqual(validateSpec(spec), []);
  const app = compileSpec(spec);
  assert.deepEqual(app.forms.find((form) => form.entity === 'leave_request')?.root.children?.[0]?.children?.map((node) => node.props?.binding), ['reason', 'startDate']);
  assert.deepEqual(app.entities.find((entity) => entity.name === 'leave_request')?.permissions?.create, ['admin']);
  for (const framework of ['sveltekit', 'nextjs'] as const) {
    const files = generateProjectFiles({ name: 'LeaveDesk', slug: 'leave-desk', spec, app, framework });
    const contract = JSON.parse(files.find((file) => file.path === 'mosaic/openapi.json')!.content);
    assert.deepEqual(Object.keys(contract.paths['/extensions/leave-request/submit'].post.requestBody.content['application/json'].schema.properties), ['reason', 'startDate']);
    assert.ok(files.some((file) => file.path.endsWith('/create-workflows.js')));
  }
  assert.deepEqual(await verifyApp(spec, app), []);
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
