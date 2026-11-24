import assert from 'node:assert/strict';
import test from 'node:test';
import { createPgliteDriver } from './db/pglite.js';
import { ensurePlatformTables } from './platform.js';
import { seedPlatform } from './seed.js';

test('seeds editable published home and not-found pages without demo data', async () => {
  const db = await createPgliteDriver('pglite://memory');
  try {
    await ensurePlatformTables(db);
    const first = await seedPlatform(db, { demo: false });
    const second = await seedPlatform(db, { demo: false });
    const pages = await db.query<{ route: string; published: boolean }>(
      `SELECT route, published FROM mosaic_pages WHERE route IN ('/', '/404') ORDER BY route`,
    );
    assert.equal(first.pages, 2);
    assert.equal(second.pages, 0);
    assert.deepEqual(pages.rows, [
      { route: '/', published: true },
      { route: '/404', published: true },
    ]);
  } finally {
    await db.close();
  }
});
