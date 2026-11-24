import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPgDriver } from '../db/driver.js';
import { ensurePlatformTables } from '../platform.js';
import { listRevisions, migrateLegacyFormVersions, recordRevision } from './revisions.js';

const databaseUrl = process.env.TEST_POSTGRES_URL;

test('revision and legacy migration contracts work on PostgreSQL', { skip: !databaseUrl }, async () => {
  const db = createPgDriver(databaseUrl!, { max: 2 });
  const suffix = randomUUID();
  const pageId = `postgres_page_${suffix}`;
  const formId = `postgres_form_${suffix}`;
  try {
    await ensurePlatformTables(db);
    const first = await recordRevision(db, {
      kind: 'page', artifactId: pageId, revision: 1, snapshot: { title: 'First' }, origin: 'studio',
    });
    const second = await recordRevision(db, {
      kind: 'page', artifactId: pageId, revision: 2, snapshot: { title: 'Second' }, origin: 'ai',
    });
    assert.equal(second.parentId, first.id);

    await db.query(
      `INSERT INTO mosaic_form_versions (id, form_id, version, snapshot, published_at)
       VALUES ($1, $2, 1, $3::jsonb, '2024-02-01T00:00:00Z')`,
      [`fv_${suffix}`, formId, JSON.stringify({ name: 'Imported' })],
    );
    assert.equal(await migrateLegacyFormVersions(db), 1);
    const imported = await listRevisions(db, 'form', formId);
    assert.equal(imported.length, 1);
    assert.equal(imported[0]?.createdAt, '2024-02-01T00:00:00.000Z');
    assert.deepEqual(imported[0]?.snapshot, { name: 'Imported' });
  } finally {
    await db.query('DELETE FROM mosaic_revisions WHERE artifact_id = ANY($1::text[])', [[pageId, formId]]).catch(() => {});
    await db.query('DELETE FROM mosaic_form_versions WHERE form_id = $1', [formId]).catch(() => {});
    await db.close();
  }
});
