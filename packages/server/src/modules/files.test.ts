import { strict as assert } from 'node:assert';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createMosaicServer } from '../app.js';

test('uploads are private, sandboxed, and deletable only by uploader or admin; withDeleted is admin-only', async () => {
  const server = await createMosaicServer({
    databaseUrl: 'pglite://memory',
    uploadsDir: mkdtempSync(join(tmpdir(), 'mosaic-files-')),
    auth: { jwtSecret: 'test-secret', allowRegistration: true },
    seed: { admin: { email: 'admin@test.io', password: 'admin-pass-1' }, demo: true },
  });
  const call = (path: string, init: RequestInit = {}, token?: string) =>
    server.app.request(path, { ...init, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers } });
  const login = async (path: string, body: object) => ((await (await call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json()) as any).data.token as string;
  try {
    const admin = await login('/api/auth/login', { email: 'admin@test.io', password: 'admin-pass-1' });
    const viewer = await login('/api/auth/register', { email: 'viewer@test.io', password: 'viewer-pass-1' });

    const form = new FormData();
    form.set('file', new File(['<script>alert(1)</script>'], 'x.html', { type: 'text/html' }));
    const uploaded = (await (await call('/api/files', { method: 'POST', body: form }, admin)).json()) as any;
    const fileId = uploaded.data.id as string;

    assert.equal((await call(`/files/${fileId}`)).status, 401, '/files is private unless publicFiles is set');
    const served = await call(`/files/${fileId}`, {}, admin);
    assert.match(served.headers.get('content-security-policy') ?? '', /sandbox/);
    assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
    assert.match(served.headers.get('cache-control') ?? '', /private/);

    assert.equal((await call(`/api/files/${fileId}`, { method: 'DELETE' }, viewer)).status, 404, 'viewer cannot delete an admin upload');
    assert.equal((await call(`/api/files/${fileId}`, { method: 'DELETE' }, admin)).status, 200);

    const entities = ((await (await call('/api/entities', {}, admin)).json()) as any).data as Array<{ name: string }>;
    const entity = entities[0]!.name;
    const someId = '00000000-0000-4000-8000-000000000000';
    assert.equal((await call(`/api/entities/${entity}/${someId}?withDeleted=true`, {}, viewer)).status, 403);
    assert.equal((await call(`/api/entities/${entity}/options?withDeleted=true`, {}, viewer)).status, 403);
    assert.equal((await call(`/api/entities/${entity}/options?withDeleted=true`, {}, admin)).status, 200);
  } finally {
    await server.close();
  }
});
