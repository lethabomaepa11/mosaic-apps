import type { RequestHandler } from './$types';
import { getCloudDb } from '#lib/server/db';

export const GET: RequestHandler = async () => {
  try {
    const db = await getCloudDb();
    await db.query('SELECT 1');
    return Response.json({ ok: true, service: 'mosaic-cloud', database: db.kind });
  } catch {
    return Response.json({ ok: false, service: 'mosaic-cloud', error: 'Database unavailable' }, { status: 503 });
  }
};
