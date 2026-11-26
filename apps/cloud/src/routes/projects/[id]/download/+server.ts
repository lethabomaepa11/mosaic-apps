import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCloudDb } from '#lib/server/db';
import { tarGzip } from '#lib/server/archive';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/login');
  const db = await getCloudDb();
  const release = await db.query<{ id: string; slug: string }>(
    `SELECT release.id, project.slug FROM cloud_releases release
     JOIN cloud_projects project ON project.id = release.project_id
     JOIN cloud_memberships membership ON membership.organization_id = project.organization_id
     WHERE project.id = $1 AND membership.user_id = $2 AND release.status = 'ready' ORDER BY release.version DESC LIMIT 1`, [params.id, locals.user.id],
  );
  const current = release.rows[0];
  if (!current) throw error(404, 'No source release is available.');
  const result = await db.query<{ path: string; content: string; mode: string }>('SELECT path, content, mode FROM cloud_release_files WHERE release_id = $1 ORDER BY path', [current.id]);
  const archive = tarGzip(result.rows);
  return new Response(new Uint8Array(archive), { headers: { 'content-type': 'application/gzip', 'content-disposition': `attachment; filename="${current.slug}.tar.gz"`, 'cache-control': 'private, no-store' } });
};
