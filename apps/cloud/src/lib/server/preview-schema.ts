import { createPgDriver, ident, type Db } from '@mosaic-apps/server';

export function previewDatabaseUrl(): string | undefined {
  return process.env.CLOUD_PREVIEW_DATABASE_URL || undefined;
}

export async function withPreviewSchema<T>(projectId: string, run: (db: Db, schema: string, url: string) => Promise<T>): Promise<T> {
  const base = previewDatabaseUrl();
  if (!base || !/^postgres(ql)?:\/\//.test(base)) throw new Error('Set CLOUD_PREVIEW_DATABASE_URL to a dedicated PostgreSQL database.');
  const schema = `mosaic_preview_${projectId.replaceAll('-', '')}`;
  const url = new URL(base);
  url.searchParams.set('options', `-c search_path=${ident(schema)}`);
  const db = createPgDriver(base, { max: 2, connectionTimeoutMillis: 12_000 });
  try {
    return await db.tx(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [schema]);
      return run(db, schema, url.toString());
    });
  } finally {
    await db.close();
  }
}

export async function drainPreviewCleanup(control: Db): Promise<void> {
  if (!previewDatabaseUrl()) return;
  const { rows: [job] } = await control.query<{ project_id: string }>('SELECT project_id FROM cloud_preview_cleanup ORDER BY created_at LIMIT 1');
  if (!job) return;
  await withPreviewSchema(job.project_id, async (db, schema) => {
    await db.query(`DROP SCHEMA IF EXISTS ${ident(schema)} CASCADE`);
    await control.query('DELETE FROM cloud_preview_cleanup WHERE project_id = $1', [job.project_id]);
  });
}
