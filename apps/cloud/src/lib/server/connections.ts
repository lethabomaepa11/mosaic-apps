import { getCloudDb, id } from './db';
import { encryptProviderSecret, VERCEL_RECONNECT, type Provider } from './providers';

export async function organizationFor(userId: string) {
  const db = await getCloudDb();
  const result = await db.query<{ id: string; name: string; role: string }>(
    `SELECT organization.id, organization.name, membership.role FROM cloud_organizations organization
     JOIN cloud_memberships membership ON membership.organization_id = organization.id
     WHERE membership.user_id = $1 ORDER BY organization.created_at LIMIT 1`, [userId],
  );
  return result.rows[0];
}

export const canManageConnections = (role: string | undefined) => role === 'owner' || role === 'admin';

/** Stores (replacing any previous) the workspace's encrypted credential for one provider. */
export async function saveConnection(input: { organizationId: string; userId: string; provider: Provider; token: string; label: string; metadata: Record<string, unknown>; method: 'token' | 'oauth' }) {
  const encrypted = encryptProviderSecret(input.token);
  const db = await getCloudDb();
  return db.tx(async (tx) => {
    await tx.query('SELECT id FROM cloud_organizations WHERE id = $1 FOR UPDATE', [input.organizationId]);
    await tx.query('DELETE FROM cloud_provider_connections WHERE organization_id = $1 AND provider = $2', [input.organizationId, input.provider]);
    await tx.query(
      `INSERT INTO cloud_provider_connections
       (id, organization_id, provider, label, status, secret_ciphertext, secret_iv, secret_tag, metadata)
       VALUES ($1, $2, $3, $4, 'connected', $5, $6, $7, $8::jsonb)`,
      [id(), input.organizationId, input.provider, input.label, encrypted.ciphertext, encrypted.iv, encrypted.tag, JSON.stringify({ ...input.metadata, method: input.method })],
    );
    await tx.query(
      `INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, 'provider.connect', 'provider', $4, $5::jsonb)`,
      [id(), input.organizationId, input.userId, input.provider, JSON.stringify({ provider: input.provider, label: input.label, method: input.method })],
    );
    if (input.provider !== 'vercel') return false;
    const resumed = await tx.query(`
      WITH recoverable AS (
        SELECT DISTINCT ON (job.project_id) job.id, job.project_id
        FROM cloud_jobs job JOIN cloud_projects project ON project.id = job.project_id
        WHERE project.organization_id = $1 AND job.status = 'failed'
          AND job.kind IN ('deliver', 'vercel-status') AND (
            job.error = $2 OR job.error = 'Vercel request failed (403): Not authorized'
            OR job.error LIKE 'Vercel request failed (401):%'
          )
          AND NOT EXISTS (
            SELECT 1 FROM cloud_jobs newer WHERE newer.project_id = job.project_id
              AND (newer.status IN ('queued', 'running') OR newer.created_at > job.created_at)
          )
        ORDER BY job.project_id, job.created_at DESC, job.id DESC
      ), requeued AS (
        UPDATE cloud_jobs job SET status = 'queued', stage = 'Vercel reconnected', error = NULL,
          attempts = 0, started_at = NULL, finished_at = NULL, run_after = now()
        FROM recoverable WHERE job.id = recoverable.id RETURNING job.project_id
      )
      UPDATE cloud_projects project SET status = 'queued', updated_at = now()
      FROM requeued WHERE project.id = requeued.project_id RETURNING project.id`,
      [input.organizationId, VERCEL_RECONNECT],
    );
    return resumed.rows.length > 0;
  });
}
