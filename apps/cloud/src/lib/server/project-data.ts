import type { Db } from '@mosaic-apps/server';
import { id } from './db';

export async function removeProjectData(tx: Db, projectId: string, organizationId: string, userId: string, providers: string[] = []) {
  await tx.query('DELETE FROM cloud_jobs WHERE project_id = $1', [projectId]);
  await tx.query('DELETE FROM cloud_messages WHERE conversation_id IN (SELECT id FROM cloud_conversations WHERE project_id = $1)', [projectId]);
  await tx.query('DELETE FROM cloud_conversations WHERE project_id = $1', [projectId]);
  await tx.query('DELETE FROM cloud_releases WHERE project_id = $1', [projectId]);
  await tx.query('DELETE FROM cloud_environments WHERE project_id = $1', [projectId]);
  await tx.query('DELETE FROM cloud_projects WHERE id = $1', [projectId]);
  if (process.env.CLOUD_PREVIEW_DATABASE_URL) await tx.query('INSERT INTO cloud_preview_cleanup (project_id) VALUES ($1) ON CONFLICT DO NOTHING', [projectId]);
  await tx.query(
    `INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, 'project.delete', 'project', $4, $5::jsonb)`, [id(), organizationId, userId, projectId, JSON.stringify({ providers })],
  );
}
