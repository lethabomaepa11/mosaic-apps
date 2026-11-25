import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCloudDb, id } from '#lib/server/db';
import { canManageConnections, organizationFor, saveConnection } from '#lib/server/connections';
import { oauthConfig } from '#lib/server/oauth';
import { isProvider, validateProviderCredential, verifyVercelConnection } from '#lib/server/providers';
import { kickJobs } from '#lib/server/jobs';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/login');
  const organization = await organizationFor(locals.user.id);
  if (!organization) throw error(403, 'No organization membership is available.');
  const db = await getCloudDb();
  const connections = await db.query<{ provider: string; label: string; status: string; metadata: Record<string, unknown>; updated_at: string }>(
    'SELECT provider, label, status, metadata, updated_at FROM cloud_provider_connections WHERE organization_id = $1 ORDER BY provider', [organization.id],
  );
  return {
    organization,
    connections: connections.rows,
    oauth: { github: Boolean(oauthConfig('github')), vercel: Boolean(oauthConfig('vercel')), neon: false },
    // Set by the OAuth callback redirect.
    notice: url.searchParams.get('connected') ? { success: true, message: `${url.searchParams.get('connected')} is connected.` }
      : url.searchParams.get('error') ? { success: false, message: url.searchParams.get('error')!.slice(0, 200) } : null,
  };
};

export const actions: Actions = {
  connect: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const organization = await organizationFor(locals.user.id);
    if (!organization || !canManageConnections(organization.role)) return fail(403, { message: 'Only workspace owners can manage connections.' });
    const form = await request.formData();
    const providerValue = String(form.get('provider') ?? '');
    const token = String(form.get('token') ?? '').trim();
    if (!isProvider(providerValue) || token.length < 10) return fail(400, { provider: providerValue, message: 'Enter a valid provider credential.' });
    let identity;
    try {
      identity = await validateProviderCredential(providerValue, token);
      if (providerValue === 'vercel') {
        const db = await getCloudDb();
        const { rows: [previous] } = await db.query<{ team_id: string | null }>(
          "SELECT metadata->>'teamId' AS team_id FROM cloud_provider_connections WHERE organization_id = $1 AND provider = 'vercel' ORDER BY updated_at DESC LIMIT 1",
          [organization.id],
        );
        await verifyVercelConnection(token, previous?.team_id);
        identity.metadata.teamId = previous?.team_id ?? null;
      }
    } catch (cause) {
      console.error(`Provider validation failed for ${providerValue}`, cause);
      return fail(400, { provider: providerValue, message: `Could not connect ${providerValue}. Check the credential and its permissions.` });
    }
    const resumed = await saveConnection({ organizationId: organization.id, userId: locals.user.id, provider: providerValue, token, label: identity.label, metadata: identity.metadata, method: 'token' });
    if (resumed) kickJobs();
    return { success: true, provider: providerValue, message: `${identity.label} is connected.` };
  },
  disconnect: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const organization = await organizationFor(locals.user.id);
    if (!organization || !canManageConnections(organization.role)) return fail(403, { message: 'Only workspace owners can manage connections.' });
    const form = await request.formData();
    const providerValue = String(form.get('provider') ?? '');
    if (!isProvider(providerValue)) return fail(400, { message: 'Unknown provider.' });
    const db = await getCloudDb();
    await db.tx(async (tx) => {
      await tx.query('DELETE FROM cloud_provider_connections WHERE organization_id = $1 AND provider = $2', [organization.id, providerValue]);
      await tx.query(
        `INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id)
         VALUES ($1, $2, $3, 'provider.disconnect', 'provider', $4)`,
        [id(), organization.id, locals.user!.id, providerValue],
      );
    });
    return { success: true, provider: providerValue, message: `${providerValue} was disconnected.` };
  },
};
