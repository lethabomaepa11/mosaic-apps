import { getCloudDb, id } from './db';
import { encryptProviderSecret, type Provider } from './providers';

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
  await db.tx(async (tx) => {
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
  });
}
