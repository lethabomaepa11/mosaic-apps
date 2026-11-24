import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { generateProjectFiles } from '../src/lib/server/generation';
import { tarGzip } from '../src/lib/server/archive';
import { decryptProviderSecret, encryptProviderSecret } from '../src/lib/server/providers';

const blueprint = {
  summary: 'A customer relationship application.',
  routes: [
    { path: '/', purpose: 'Public homepage', access: 'public' as const },
    { path: '/customers', purpose: 'Manage customers', access: 'authenticated' as const },
  ],
  entities: [{ name: 'Customer', purpose: 'Customer records', fields: ['name:string', 'email:string'] }],
  roles: ['admin'], workflows: ['Create customer'], implementationNotes: [],
};

test('generation creates a complete source repository and migration', () => {
  const files = generateProjectFiles({ name: 'Northstar CRM', slug: 'northstar-crm', theme: 'corporate', blueprint });
  const paths = files.map((file) => file.path);
  for (const required of ['package.json', 'src/routes/+page.svelte', 'src/routes/customers/+page.svelte', 'migrations/001_initial.sql', 'AGENTS.md', '.agents/skills/mosaic-app/SKILL.md']) assert.ok(paths.includes(required), required);
  assert.match(files.find((file) => file.path.includes('001_initial'))!.content, /CREATE TABLE IF NOT EXISTS customer/);
  assert.equal(new Set(paths).size, paths.length);
});

test('release archive is a valid gzip-wrapped tar', () => {
  const archive = tarGzip([{ path: 'README.md', content: '# App\n' }]);
  assert.equal(archive[0], 0x1f); assert.equal(archive[1], 0x8b);
  const tar = gunzipSync(archive);
  assert.equal(tar.subarray(0, 9).toString(), 'README.md');
  assert.equal(tar.subarray(257, 262).toString(), 'ustar');
});

test('provider credentials are encrypted and recoverable server-side', () => {
  const encrypted = encryptProviderSecret('provider-secret-value');
  assert.notEqual(encrypted.ciphertext, 'provider-secret-value');
  assert.equal(decryptProviderSecret(encrypted), 'provider-secret-value');
});

test('model text cannot inject Svelte expressions or tags', () => {
  const files = generateProjectFiles({ name: 'A {x} <b>', slug: 'a', theme: 'corporate', blueprint: { ...blueprint, routes: [{ path: '/', purpose: 'Use {secret} & <script>', access: 'public' as const }] } });
  for (const path of ['src/routes/+page.svelte', 'src/routes/+layout.svelte']) {
    const markup = files.find((file) => file.path === path)!.content.replace(/<script>.*?<\/script>/s, '').replace(/\{@render children\(\)\}/, '');
    assert.doesNotMatch(markup, /\{(?!@)|<b>|<script>/, path);
  }
});

test('release archive stores long paths in the ustar prefix', () => {
  const path = `${'nested/'.repeat(20)}file.svelte`;
  const tar = gunzipSync(tarGzip([{ path, content: 'x' }]));
  const field = (start: number, end: number) => tar.subarray(start, end).toString().replace(/\0.*$/s, '');
  assert.equal(`${field(345, 500)}/${field(0, 100)}`, path);
});

test('planner route params (:id) become SvelteKit [id] directories', () => {
  const files = generateProjectFiles({ name: 'A', slug: 'a', theme: 'corporate', blueprint: { ...blueprint, routes: [{ path: '/equipment/:id/edit', purpose: 'Edit', access: 'authenticated' as const }] } });
  assert.ok(files.some((file) => file.path === 'src/routes/equipment/[id]/edit/+page.svelte'));
});
