/**
 * Live end-to-end verification (no external DB needed):
 * boots the Mosaic API on embedded Postgres (PGlite), seeds demo data,
 * then exercises auth, auto-CRUD, filters, forms, migrations and audit.
 *
 * Run: npm run e2e
 */
import http from 'node:http';
import assert from 'node:assert/strict';
import { createMosaicServer } from '../packages/server/dist/index.js';

const PORT = 8799;
const BASE = `http://localhost:${PORT}/api`;

let passed = 0;
let failed = 0;

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ✔ ${name}`);
    })
    .catch((err) => {
      failed++;
      console.error(`  ✖ ${name}\n     ${err.message}`);
    });
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const server = await createMosaicServer({
  databaseUrl: 'pglite://memory',
  seed: { admin: { email: 'admin@mosaic.local', password: 'admin1234' }, demo: true },
  auth: { enabled: true, allowRegistration: false },
  log: false,
});

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', BASE);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v[0] : String(v));
  const request = new Request(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
    duplex: 'half',
  });
  const response = await server.app.fetch(request);
  const buf = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(buf);
});

await new Promise((resolve) => httpServer.listen(PORT, resolve));
console.log(`\n▦ Mosaic e2e on http://localhost:${PORT}\n`);

await check('health endpoint reports ok', async () => {
  const { json } = await api('/health');
  assert.equal(json.success, true);
  assert.equal(json.data.ok, true);
  assert.equal(json.data.db, true);
});

await check('public navigation and theme endpoints have safe defaults', async () => {
  const nav = await api('/nav');
  const theme = await api('/theme');
  assert.equal(nav.status, 200);
  assert.equal(nav.json.data.items[0].href, '/');
  assert.equal(theme.status, 200);
  assert.deepEqual(theme.json.data, {});
});

await check('login as seeded admin', async () => {
  const { status, json } = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@mosaic.local', password: 'admin1234' },
  });
  assert.equal(status, 200);
  assert.ok(json.data.token);
  assert.deepEqual(json.data.user.roles, ['admin']);
  globalThis.__token = json.data.token;
});

await check('bad credentials rejected (401)', async () => {
  const { status } = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@mosaic.local', password: 'wrong' },
  });
  assert.equal(status, 401);
});

await check('/auth/me returns admin profile', async () => {
  const { json } = await api('/auth/me', { token: globalThis.__token });
  assert.equal(json.data.email, 'admin@mosaic.local');
  assert.equal(json.data.isAdmin, true);
});

await check('entity registry lists seeded entities', async () => {
  const { json } = await api('/entities', { token: globalThis.__token });
  const names = json.data.map((e) => e.name);
  for (const n of ['customer', 'employee', 'product', 'order']) assert.ok(names.includes(n), `${n} missing`);
});

await check('CRUD create on customer', async () => {
  const { status, json } = await api('/entities/customer', {
    method: 'POST',
    token: globalThis.__token,
    body: { name: 'Ada Lovelace', email: 'ada@analytical.io', status: 'active', creditLimit: 5000 },
  });
  assert.equal(status, 201);
  assert.ok(json.data.id);
  globalThis.__customerId = json.data.id;
});

await check('CRUD read single + list with filter', async () => {
  const one = await api(`/entities/customer/${globalThis.__customerId}`, { token: globalThis.__token });
  assert.equal(one.json.data.email, 'ada@analytical.io');
  const list = await api(
    '/entities/customer?filter=' + encodeURIComponent(JSON.stringify([{ field: 'status', op: 'eq', value: 'active' }])),
    { token: globalThis.__token },
  );
  assert.ok(list.json.data.data.length >= 1);
  assert.ok(list.json.data.total >= 1);
});

await check('CRUD update writes audit entry', async () => {
  const { status } = await api(`/entities/customer/${globalThis.__customerId}`, {
    method: 'PATCH',
    token: globalThis.__token,
    body: { company: 'Analytical Engines' },
  });
  assert.equal(status, 200);
  const audit = await api('/audit?entity=customer', { token: globalThis.__token });
  const update = audit.json.data.data.find((a) => a.action === 'update');
  assert.ok(update, 'update audit missing');
  assert.ok(update.changes.company, 'audit diff missing company');
});

await check('validation rejects bad payload (422)', async () => {
  const { status, json } = await api('/entities/customer', {
    method: 'POST',
    token: globalThis.__token,
    body: { email: 'not-an-email' },
  });
  assert.equal(status, 422);
  assert.equal(json.error.code, 'VALIDATION');
});

await check('unique violation maps to 409', async () => {
  const { status } = await api('/entities/customer', {
    method: 'POST',
    token: globalThis.__token,
    body: { name: 'Dup', email: 'ada@analytical.io' },
  });
  assert.equal(status, 409);
});

await check('include=owner_label resolves relation label', async () => {
  const created = await api('/entities/employee', {
    method: 'POST',
    token: globalThis.__token,
    body: { fullName: 'Grace Hopper', email: 'grace@navy.mil' },
  });
  const empId = created.json.data.id;
  const cust = await api('/entities/customer', {
    method: 'POST',
    token: globalThis.__token,
    body: { name: 'Grace Customer', owner: empId },
  });
  const custId = cust.json.data.id;
  const withRef = await api(`/entities/customer/${custId}?include=owner`, { token: globalThis.__token });
  assert.equal(withRef.json.data.owner_label, 'Grace Hopper');
});

await check('soft delete hides record unless admin withDeleted', async () => {
  const created = await api('/entities/customer', {
    method: 'POST',
    token: globalThis.__token,
    body: { name: 'Temporary' },
  });
  const id = created.json.data.id;
  await api(`/entities/customer/${id}`, { method: 'DELETE', token: globalThis.__token });
  const hidden = await api(`/entities/customer/${id}`, { token: globalThis.__token });
  assert.equal(hidden.status, 404);
  const admin = await api(`/entities/customer/${id}?withDeleted=true`, { token: globalThis.__token });
  assert.equal(admin.status, 200);
});

await check('migration plan is empty after seed applied', async () => {
  const { json } = await api('/migrations/plan', { token: globalThis.__token });
  assert.equal(json.data.empty, true);
});

await check('seeded forms are published + fetchable by slug', async () => {
  const list = await api('/forms?published=true', { token: globalThis.__token });
  const slugs = list.json.data.map((f) => f.slug);
  assert.ok(slugs.includes('customer-form'));
  const form = await api('/forms/customer-form', { token: globalThis.__token });
  assert.equal(form.json.data.entity, 'customer');
  assert.ok(form.json.data.root.children.length >= 1);
});

await check('form publish bumps version and snapshots', async () => {
  const created = await api('/forms', {
    method: 'POST',
    token: globalThis.__token,
    body: {
      name: 'E2E Form', entity: 'customer',
      settings: { seo: { title: 'E2E SEO title', description: 'A searchable form', robots: 'index,follow' } },
      schema: { type: 'form', children: [{ id: 'submit_button', type: 'button', props: { label: 'Save customer', variant: 'primary' } }] },
    },
  });
  const id = created.json.data.id;
  const published = await api(`/forms/${id}/publish`, { method: 'POST', token: globalThis.__token });
  assert.equal(published.json.data.published, true);
  assert.equal(published.json.data.version, 2);
  const unchanged = await api(`/forms/${id}/publish`, { method: 'POST', token: globalThis.__token });
  assert.equal(unchanged.status, 200);
  assert.equal(unchanged.json.data.version, 2, 'unchanged content should not create another published version');
  const saved = await api(`/forms/${id}`, { token: globalThis.__token });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.data.root.children[0].props.label, 'Save customer');
  assert.equal(saved.json.data.settings.seo.title, 'E2E SEO title');
  const versions = await api(`/forms/${id}/versions`, { token: globalThis.__token });
  assert.ok(versions.json.data.length >= 1);
});

await check('atomic save publishes tree changes and rejects stale versions', async () => {
  const created = await api('/forms', {
    method: 'POST', token: globalThis.__token,
    body: { name: 'Atomic E2E Form', schema: { type: 'form', children: [] } },
  });
  const id = created.json.data.id;
  const saved = await api(`/forms/${id}/save-and-publish`, {
    method: 'PUT', token: globalThis.__token,
    body: {
      expectedVersion: 1,
      name: 'Atomic E2E Form',
      root: { type: 'form', children: [{ id: 'atomic_button', type: 'button', props: { label: 'Atomic save' } }] },
    },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.data.published, true);
  assert.equal(saved.json.data.version, 2);
  assert.equal(saved.json.data.root.children[0].props.label, 'Atomic save');

  const unchanged = await api(`/forms/${id}/save-and-publish`, {
    method: 'PUT', token: globalThis.__token,
    body: { expectedVersion: 2, name: 'Atomic E2E Form', root: saved.json.data.root },
  });
  assert.equal(unchanged.json.data.version, 2);

  const stale = await api(`/forms/${id}/save-and-publish`, {
    method: 'PUT', token: globalThis.__token,
    body: { expectedVersion: 1, name: 'Stale overwrite', root: saved.json.data.root },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.error.code, 'STALE_VERSION');
});

await check('form folders can be created, renamed, and deleted', async () => {
  const created = await api('/forms', {
    method: 'POST',
    token: globalThis.__token,
    body: { name: 'Folder E2E Form', schema: { type: 'form', children: [] }, folder: 'sales/quotes' },
  });
  assert.equal(created.status, 201);
  const formId = created.json.data.id;
  assert.equal(created.json.data.folder, 'sales/quotes');

  const folders = await api('/forms/folders', { token: globalThis.__token });
  assert.ok(folders.json.data.includes('sales/quotes'));

  const renamed = await api('/forms/folders/rename', {
    method: 'POST', token: globalThis.__token, body: { from: 'sales', to: 'revenue' },
  });
  assert.equal(renamed.status, 200);
  const moved = await api(`/forms/${formId}`, { token: globalThis.__token });
  assert.equal(moved.json.data.folder, 'revenue/quotes');

  const deleted = await api('/forms/folders/delete', {
    method: 'POST', token: globalThis.__token, body: { path: 'revenue' },
  });
  assert.equal(deleted.status, 200);
  const atRoot = await api(`/forms/${formId}`, { token: globalThis.__token });
  assert.equal(atRoot.json.data.folder, undefined);
});

await check('entity meta exposes endpoints', async () => {
  const { json } = await api('/entities/order/meta', { token: globalThis.__token });
  assert.ok(json.data.endpoints.list.includes('/api/entities/order'));
});

await check('options endpoint serves picker data', async () => {
  const { json } = await api('/entities/customer/options?q=ada', { token: globalThis.__token });
  assert.ok(json.data.some((o) => o.label.includes('Ada')));
});

await check('settings + ref lists readable', async () => {
  const settings = await api('/settings', { token: globalThis.__token });
  assert.ok(settings.json.data.some((s) => s.key === 'app.name'));
  const reflists = await api('/ref-lists', { token: globalThis.__token });
  assert.ok(reflists.json.data.some((r) => r.name === 'ticket-priority'));
});

await check('unauthorized access is blocked (401)', async () => {
  const { status } = await api('/entities');
  assert.equal(status, 401);
});

httpServer.close();
await server.close();

console.log(`\n▦ e2e result: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
