import { timingSafeEqual } from 'node:crypto';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canManageConnections, organizationFor, saveConnection } from '#lib/server/connections';
import { exchangeCode, OAUTH_STATE_COOKIE, oauthConfig, type OAuthProvider } from '#lib/server/oauth';
import { validateProviderCredential } from '#lib/server/providers';

const NAMES: Record<OAuthProvider, string> = { github: 'GitHub', vercel: 'Vercel' };
const back = (query: Record<string, string>) => `/settings/connections?${new URLSearchParams(query)}`;

export const GET: RequestHandler = async ({ params, url, cookies, locals }) => {
  if (!locals.user) throw redirect(303, '/login');
  const provider = params.provider as OAuthProvider;
  const config = (provider === 'github' || provider === 'vercel') ? oauthConfig(provider) : undefined;
  if (!config) throw error(404, 'This provider has no OAuth sign-in configured.');

  const expected = Buffer.from(cookies.get(OAUTH_STATE_COOKIE) ?? '');
  const received = Buffer.from(`${provider}.${url.searchParams.get('state') ?? ''}`);
  cookies.delete(OAUTH_STATE_COOKIE, { path: '/settings/connections' });
  if (!expected.length || expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw redirect(303, back({ error: `${NAMES[provider]} sign-in expired or was not started here. Please try again.` }));
  }
  const denied = url.searchParams.get('error');
  if (denied) throw redirect(303, back({ error: `${NAMES[provider]} access was not granted.` }));
  const code = url.searchParams.get('code');
  if (!code) throw redirect(303, back({ error: `${NAMES[provider]} did not return an authorization code.` }));

  const organization = await organizationFor(locals.user.id);
  if (!organization || !canManageConnections(organization.role)) throw error(403, 'Only workspace owners can manage connections.');

  let saved: string;
  try {
    const { token, teamId } = await exchangeCode(provider, config, url.origin, code);
    // Vercel integration tokens installed on a team may not read /v2/user; the team id is what deliveries need.
    const identity = await validateProviderCredential(provider, token).catch((cause) => {
      if (provider === 'vercel') return { label: teamId ? 'Vercel team' : 'Vercel account', metadata: {} };
      throw cause;
    });
    await saveConnection({ organizationId: organization.id, userId: locals.user.id, provider, token, label: identity.label, metadata: { ...identity.metadata, teamId }, method: 'oauth' });
    saved = identity.label;
  } catch (cause) {
    console.error(`${provider} OAuth callback failed`, cause);
    throw redirect(303, back({ error: `Could not connect ${NAMES[provider]}. Please try again.` }));
  }
  throw redirect(303, back({ connected: `${NAMES[provider]} (${saved})` }));
};
