import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMosaicServer } from '../app.js';
import type { EntityWorkflow } from '@mosaic-apps/core';

test('entity views are authorized, linked, published atomically and protected against overwrite', async () => {
  const server = await createMosaicServer({ databaseUrl: 'pglite://memory', seed: true, auth: { enabled: true, jwtSecret: 'workflow-test-secret-not-for-production' } });
  try {
    const call = (body: unknown, token?: string) => server.app.request('/api/workflows/entity', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    assert.equal((await call({ entity: 'customer' })).status, 401);
    const login = await server.app.request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@mosaic.local', password: 'admin1234' }) });
    const token = ((await login.json()) as { data: { token: string } }).data.token;
    const response = await call({ entity: 'customer', name: 'Client workflow', columns: ['name', 'email'] }, token);
    assert.equal(response.status, 201, await response.clone().text());
    const workflow = ((await response.json()) as { data: EntityWorkflow }).data;
    assert.equal(workflow.page.root.children?.[0]?.props?.detailFormId, workflow.forms.detail.id);
    assert.equal((await server.app.request(`/api/pages/${workflow.page.slug}`)).status, 401, 'Private page definitions must be protected by the server.');
    const publicPages = (await (await server.app.request('/api/pages?published=true')).json()) as { data: { id: string }[] };
    assert.ok(!publicPages.data.some((page) => page.id === workflow.page.id), 'Private pages must not leak in the anonymous catalog.');
    assert.equal((await server.app.request(`/api/forms/${workflow.forms.detail.id}/versions`)).status, 401);
    assert.equal((await server.app.request(`/api/pages/${workflow.page.slug}`, { headers: { Authorization: `Bearer ${token}` } })).status, 200);
    const stored = await server.db.query<{ total: string }>('SELECT count(*) AS total FROM mosaic_forms WHERE id = ANY($1::text[])', [Object.values(workflow.forms).map((form: any) => form.id)]);
    assert.equal(Number(stored.rows[0]?.total), 3);
    assert.equal((await call({ entity: 'customer', name: 'Client workflow' }, token)).status, 409);
    assert.equal((await call({ entity: 'customer', name: 'Invalid workflow', fields: ['email'] }, token)).status, 422);
    const failed = await server.db.query('SELECT id FROM mosaic_pages WHERE slug = $1', ['invalid-workflow']);
    assert.equal(failed.rows.length, 0);
    const snapshots = await server.db.query('SELECT version FROM mosaic_form_versions WHERE form_id = $1', [workflow.forms.detail.id]);
    assert.equal(snapshots.rows.length, 1);
    const nav = ((await (await server.app.request('/api/nav', { headers: { Authorization: `Bearer ${token}` } })).json()) as { data: { items: { href: string }[] } }).data.items;
    assert.ok(nav.some(item => item.href === workflow.page.route));
    const publicNav = ((await (await server.app.request('/api/nav')).json()) as { data: { items: { href: string }[] } }).data.items;
    assert.ok(!publicNav.some(item => item.href === workflow.page.route));
    const route = `/clients/:id`;
    const saved = await server.app.request(`/api/pages/${workflow.page.id}/save-and-publish`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ route, expectedVersion: 1 }) });
    assert.equal(saved.status, 200);
    const resolved = await server.app.request('/api/pages/resolve?path=%2Fclients%2F123', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(resolved.status, 200);
    assert.deepEqual(((await resolved.json()) as { data: { params: unknown } }).data.params, { id: '123' });
    assert.equal((await server.app.request('/api/pages/resolve?path=%2Fclients%2F123')).status, 401);
  } finally { await server.close(); }
});
