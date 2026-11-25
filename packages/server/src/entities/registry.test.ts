import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { EntityDef } from '@mosaic-apps/core';
import { createMosaicServer } from '../app.js';
import { crudRoutes } from '../crud/router.js';
import { resolveUser, type AuthEnv } from '../modules/auth.js';

const postgresUrl = process.env.TEST_ENTITY_REGISTRY_DATABASE_URL;
const jwtSecret = 'registry-integration-test-secret';
const email = 'registry-admin@example.test';
const password = 'registry-integration-test-password';

async function verifyRegistry(databaseUrl: string, separateServer: boolean): Promise<void> {
  const writer = await createMosaicServer({ databaseUrl, auth: { jwtSecret }, seed: { admin: { email, password }, demo: false } });
  let reader: Awaited<ReturnType<typeof createMosaicServer>> | undefined;
  try {
    // PostgreSQL exercises independent connection pools. The local test runs the
    // same HTTP routes and SQL against a shared embedded database.
    if (separateServer) reader = await createMosaicServer({ databaseUrl, auth: { jwtSecret } });
    const readerApp = reader?.app ?? new Hono<AuthEnv>()
      .use('*', resolveUser({ db: writer.db, secret: jwtSecret, enabled: true }))
      .route('/api/entities', crudRoutes({ db: writer.db, authEnabled: true }));

    async function request(app: Hono<AuthEnv>, method: string, path: string, status: number, body?: unknown, token?: string) {
      const response = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const result = await response.json() as { data: any; error?: unknown };
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result.error)}`);
      return result.data;
    }
    const { token } = await request(writer.app, 'POST', '/api/auth/login', 200, { email, password });
    const write = (method: string, path: string, status: number, body?: unknown) => request(writer.app, method, path, status, body, token);
    const read = (method: string, path: string, status = 200, body?: unknown) => request(readerApp, method, path, status, body, token);
    const person: EntityDef = { name: 'registry_person', fields: [{ name: 'name', type: 'string' }] };
    const loan: EntityDef = { name: 'registry_loan', fields: [{ name: 'borrower', type: 'ref', refEntity: person.name }] };
    const peoplePath = `/api/entities/${person.name}`;
    const loansPath = `/api/entities/${loan.name}`;
    const viewerCredentials = { email: 'registry-viewer@example.test', password };
    await write('POST', '/api/users', 201, { ...viewerCredentials, roles: ['viewer'] });
    const viewer = await request(writer.app, 'POST', '/api/auth/login', 200, viewerCredentials);

    await read('GET', `${loansPath}/meta`, 404);
    await write('PUT', peoplePath, 200, { entity: person });
    await write('PUT', loansPath, 200, { entity: loan });
    await write('POST', '/api/migrations/apply', 200, { allowDestructive: false });
    const borrower = await read('POST', peoplePath, 201, { name: 'First label' });
    const item = await read('POST', loansPath, 201, { borrower: borrower.id });
    assert.equal((await read('GET', `${loansPath}?include=borrower`)).data[0].borrower_label, 'First label');
    await request(readerApp, 'GET', `${peoplePath}/meta`, 200, undefined, viewer.token);

    await write('PUT', peoplePath, 200, { entity: {
      ...person, fields: [...person.fields, { name: 'displayName', type: 'string' }], list: { labelField: 'displayName' },
      permissions: { read: ['admin'] },
    } });
    await request(readerApp, 'GET', `${peoplePath}/meta`, 403, undefined, viewer.token);
    const plan = await write('GET', `/api/migrations/plan?entity=${person.name}`, 200);
    assert.equal(plan.empty, false);
    await write('POST', '/api/migrations/apply', 200, { allowDestructive: false });
    const updated = await read('PATCH', `${peoplePath}/${borrower.id}`, 200, { displayName: 'Updated label' });
    assert.equal(updated.displayName, 'Updated label');
    assert.equal((await read('GET', `${loansPath}/${item.id}?include=borrower`)).borrower_label, 'Updated label');

    await write('DELETE', loansPath, 200);
    await read('GET', `${loansPath}/meta`, 404);
    assert.equal((await writer.db.query('SELECT COUNT(*)::int AS total FROM registry_loan')).rows[0]?.total, 1);
  } finally {
    await reader?.close();
    await writer.close();
  }
}

test('CRUD reads current metadata and included references from the database', async () => {
  await verifyRegistry('pglite://memory', false);
});

test('two PostgreSQL servers share entity creation, migrations, updates, and removal', { skip: !postgresUrl }, async () => {
  await verifyRegistry(postgresUrl!, true);
});
