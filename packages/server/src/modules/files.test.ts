import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMosaicServer } from '../app.js';
import { hashPassword, signJwt } from './auth.js';

test('database uploads preserve bytes, enforce privacy and ownership and validate public logos', async () => {
  const server = await createMosaicServer({ databaseUrl: 'pglite://memory', seed: true, fileStorage: 'database', maxFileBytes: 1024 });
  try {
    const login = await server.app.request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@mosaic.local', password: 'admin1234' }) });
    const token = ((await login.json()) as { data: { token: string } }).data.token;
    const upload = (bytes: Uint8Array, purpose = '', mime = 'text/plain', bearer = token) => {
      const body = new FormData(); body.append('file', new File([new Uint8Array(bytes)], 'example.png', { type: mime })); if (purpose) body.append('purpose', purpose);
      return server.app.request('/api/files', { method: 'POST', headers: { Authorization: `Bearer ${bearer}` }, body });
    };
    const bytes = new TextEncoder().encode('durable business attachment');
    const uploaded = await upload(bytes); assert.equal(uploaded.status, 201, await uploaded.clone().text());
    const file = ((await uploaded.json()) as { data: { id: string } }).data;
    assert.equal((await server.app.request(`/files/${file.id}`)).status, 401);
    const content = await server.app.request(`/files/${file.id}`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(content.status, 200); assert.equal(content.headers.get('cache-control'), 'private, no-store');
    assert.equal(await content.text(), 'durable business attachment');
    assert.equal((await upload(new Uint8Array(1025))).status, 413);
    assert.equal((await upload(new TextEncoder().encode('<script>bad</script>'), 'brand', 'image/png')).status, 422);
    const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDqoAAAAASUVORK5CYII=', 'base64'));
    const brand = await upload(png, 'brand', 'image/png'); assert.equal(brand.status, 201);
    const publicFile = ((await brand.json()) as { data: { id: string } }).data;
    assert.equal((await server.app.request(`/files/${publicFile.id}`)).status, 200);
    const viewer = await server.db.query<{ id: string }>('INSERT INTO mosaic_users (email,name,password_hash,roles) VALUES ($1,$2,$3,$4) RETURNING id', ['viewer@files.test', 'Viewer', hashPassword('files-viewer-password'), ['viewer']]);
    const viewerToken = signJwt({ sub: viewer.rows[0]!.id, email: 'viewer@files.test', roles: ['viewer'] }, server.jwtSecret, 60);
    assert.equal((await upload(png, 'brand', 'image/png', viewerToken)).status, 403);
    assert.equal((await server.app.request(`/api/files/${file.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${viewerToken}` } })).status, 404);
    assert.equal((await server.app.request(`/api/files/${file.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).status, 200);
    assert.equal((await server.app.request(`/files/${file.id}`, { headers: { Authorization: `Bearer ${token}` } })).status, 404);
    const stored = await server.db.query<{ path: string; data: Uint8Array }>('SELECT path,data FROM mosaic_files WHERE id = $1', [publicFile.id]);
    assert.ok(stored.rows[0]?.path.startsWith('database:')); assert.deepEqual(new Uint8Array(stored.rows[0]!.data), png);
  } finally { await server.close(); }
});
