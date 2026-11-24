import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCloudDb } from '#lib/server/db';
export const GET: RequestHandler = async ({ params }) => {
  const db = await getCloudDb();
  const result = await db.query<{ id: string; name: string; status: string }>('SELECT id, name, status FROM cloud_projects WHERE slug = $1', [params.slug]);
  if (!result.rows[0]) throw error(404, 'App not found');
  return json({ ok: true, app: result.rows[0] });
};
