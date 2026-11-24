import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { PageDef } from '@mosaic-apps/core';
import { createPgliteDriver } from '../db/pglite.js';
import { ensurePlatformTables } from '../platform.js';
import type { AuthEnv } from './auth.js';
import { artifactRoutes } from './artifacts.js';

type Envelope<T> = { success: true; data: T } | { success: false; error: { code?: string } };

test('page history supports diff and conflict-safe forward restore', async () => {
  const db = await createPgliteDriver('pglite://memory');
  try {
    await ensurePlatformTables(db);
    const app = new Hono<AuthEnv>();
    app.use('*', async (c, next) => {
      c.set('user', {
        id: '00000000-0000-4000-8000-000000000001', email: 'builder@example.com', name: 'Builder', roles: ['admin'], permissions: ['pages:manage'],
      });
      await next();
    });
    app.route('/pages', artifactRoutes({ db, kind: 'page', managePerm: 'pages:manage' }));

    const call = async <T>(path: string, method = 'GET', body?: unknown) => {
      const response = await app.request(path, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { response, payload: await response.json() as Envelope<T> };
    };

    const created = await call<PageDef>('/pages', 'POST', { name: 'Landing', route: '/', schema: { type: 'page', children: [] } });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.success, true);
    if (!created.payload.success) return;
    const id = created.payload.data.id;

    const first = await call<PageDef>(`/pages/${id}/save-and-publish`, 'PUT', { expectedVersion: 1, name: 'First' });
    assert.equal(first.payload.success && first.payload.data.version, 2);
    const second = await call<PageDef>(`/pages/${id}/save-and-publish`, 'PUT', { expectedVersion: 2, name: 'Second' });
    assert.equal(second.payload.success && second.payload.data.version, 3);

    const diff = await call<{ changes: { path: string; before?: unknown; after?: unknown }[] }>(`/pages/${id}/revisions/2/diff?against=current`);
    assert.equal(diff.payload.success, true);
    if (diff.payload.success) {
      assert.deepEqual(diff.payload.data.changes.find((change) => change.path === 'name'), {
        path: 'name', kind: 'changed', before: 'Second', after: 'First',
      });
    }

    const restored = await call<PageDef>(`/pages/${id}/revisions/2/restore`, 'POST', { expectedVersion: 3 });
    assert.equal(restored.payload.success, true);
    if (restored.payload.success) {
      assert.equal(restored.payload.data.name, 'First');
      assert.equal(restored.payload.data.version, 4);
    }

    const stale = await call<PageDef>(`/pages/${id}/revisions/2/restore`, 'POST', { expectedVersion: 3 });
    assert.equal(stale.response.status, 409);
    assert.equal(!stale.payload.success && stale.payload.error.code, 'STALE_VERSION');
  } finally {
    await db.close();
  }
});
