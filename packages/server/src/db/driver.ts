/** Thin database abstraction so the platform can run on pg now (pglite later). */

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

export interface QueryResultLike<R> {
  rows: R[];
  rowCount: number;
}

export interface Db {
  query<R extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResultLike<R>>;
  /** Run fn inside a transaction; commits on resolve, rolls back on throw. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly kind: 'pg' | 'pglite';
}

class PgDriver implements Db {
  readonly kind = 'pg' as const;
  constructor(private pool: Pool) {}

  async query<R extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResultLike<R>> {
    const res = await this.pool.query<R>(sql, params as unknown[]);
    return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
  }

  async tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const txDb: Db = {
      kind: 'pg',
      query: <R extends QueryResultRow>(sql: string, params: unknown[] = []) =>
        client.query<R>(sql, params as unknown[]).then((res) => ({ rows: res.rows, rowCount: res.rowCount ?? res.rows.length })),
      tx: () => {
        throw new Error('Nested transactions are not supported');
      },
      close: async () => {
        /* no-op: client released below */
      },
    };
    try {
      await client.query('BEGIN');
      const result = await fn(txDb);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* connection already broken */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createPgDriver(connectionString: string, opts: { max?: number } = {}): Db {
  const pool = new Pool({
    connectionString,
    max: opts.max ?? 10,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (err) => {
    console.error('[mosaic] postgres pool error:', err.message);
  });
  return new PgDriver(pool);
}

/** SQL identifier quoting (always double quotes; caller must validate names). */
export function ident(name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${JSON.stringify(name)}`);
  }
  return `"${name}"`;
}
