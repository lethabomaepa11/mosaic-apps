/** PGlite driver — real Postgres compiled to WASM, no external server needed.
 *  Enabled via DATABASE_URL `pglite://memory` (default) or `pglite://<dir>`. */

import { PGlite } from '@electric-sql/pglite';
import type { Db, QueryResultLike } from './driver.js';

class PgliteDriver implements Db {
  readonly kind = 'pglite' as const;
  constructor(private pg: PGlite) {}

  async query<R>(sql: string, params: unknown[] = []): Promise<QueryResultLike<R>> {
    const res = await this.pg.query<R>(sql, params as unknown[]);
    return { rows: res.rows, rowCount: res.rows.length };
  }

  async tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    return this.pg.transaction(async (tx) => {
      const txDb: Db = {
        kind: 'pglite',
        query: async (sql: string, params: unknown[] = []) => {
          const res = await tx.query(sql, params as unknown[]);
          return { rows: res.rows as never[], rowCount: res.rows.length };
        },
        tx: () => Promise.reject(new Error('Nested transactions are not supported')),
        close: async () => undefined,
      };
      return fn(txDb);
    });
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}

/** Parse a pglite URL: `pglite://memory` (default) or `pglite://./data-dir`. */
export function createPgliteDriver(url = 'pglite://memory'): Promise<Db> {
  const dir = url.replace(/^pglite:\/\//, '');
  const pg = new PGlite(dir === 'memory' ? undefined : dir);
  return Promise.resolve(new PgliteDriver(pg));
}

export function isPgliteUrl(url: string): boolean {
  return url.startsWith('pglite');
}
