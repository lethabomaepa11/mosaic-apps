import assert from 'node:assert/strict';
import test from 'node:test';
import { createPgliteDriver } from '../db/pglite.js';
import { ensurePlatformTables } from '../platform.js';
import { revisionChecksum } from './revisions.js';
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
