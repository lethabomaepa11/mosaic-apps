import assert from 'node:assert/strict';
import test from 'node:test';
import { createPgliteDriver } from '../db/pglite.js';
import { ensurePlatformTables } from '../platform.js';
import { migrateLegacyFormVersions, revisionChecksum } from './revisions.js';
import { getPreviousRevision, listRevisions, recordRevision } from './revisions.js';

test('revision checksum ignores object key order but preserves content', () => {
  assert.equal(revisionChecksum({ b: 2, a: { y: 2, x: 1 } }), revisionChecksum({ a: { x: 1, y: 2 }, b: 2 }));
  assert.notEqual(revisionChecksum({ value: 1 }), revisionChecksum({ value: 2 }));
});

test('records immutable linked revisions in PGlite', async () => {
  const db = await createPgliteDriver('pglite://memory');
  try {
    await ensurePlatformTables(db);
    const first = await recordRevision(db, {
      kind: 'page', artifactId: 'home', revision: 1, snapshot: { title: 'Home' }, origin: 'studio',
    });
    const second = await recordRevision(db, {
      kind: 'page', artifactId: 'home', revision: 2, snapshot: { title: 'Welcome' }, origin: 'ai',
    });
    assert.equal(second.parentId, first.id);
    assert.deepEqual((await listRevisions(db, 'page', 'home')).map((item) => item.revision), [2, 1]);
    assert.equal((await getPreviousRevision(db, 'page', 'home', 2))?.id, first.id);
    assert.equal(await getPreviousRevision(db, 'page', 'home', 1), undefined);
  } finally {
    await db.close();
  }
});

test('imports and links legacy form history idempotently', async () => {
  const db = await createPgliteDriver('pglite://memory');
  try {
    await ensurePlatformTables(db);
    const current = await recordRevision(db, {
      kind: 'form', artifactId: 'contact', revision: 3, snapshot: { name: 'Current' }, origin: 'studio',
    });
    await db.query(
      `INSERT INTO mosaic_form_versions (id, form_id, version, snapshot, published_at)
       VALUES ('fv_1', 'contact', 1, $1::jsonb, '2024-01-01T00:00:00Z'),
              ('fv_2', 'contact', 2, $2::jsonb, '2024-01-02T00:00:00Z')`,
      [JSON.stringify({ name: 'First' }), JSON.stringify({ name: 'Second' })],
    );

    assert.equal(await migrateLegacyFormVersions(db), 2);
    assert.equal(await migrateLegacyFormVersions(db), 0);
    const revisions = await listRevisions(db, 'form', 'contact');
    assert.deepEqual(revisions.map((item) => item.revision), [3, 2, 1]);
    assert.equal(revisions[0]?.id, current.id);
    assert.equal(revisions[0]?.parentId, revisions[1]?.id);
    assert.equal(revisions[1]?.parentId, revisions[2]?.id);
    assert.equal(revisions[2]?.parentId, undefined);
    assert.equal(revisions[2]?.createdAt, '2024-01-01T00:00:00.000Z');
  } finally {
    await db.close();
  }
});
