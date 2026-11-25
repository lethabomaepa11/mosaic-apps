import { randomBytes } from 'node:crypto';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hosted } from '#lib/server/db';
import { canManageConnections, organizationFor } from '#lib/server/connections';
import { authorizeUrl, OAUTH_STATE_COOKIE, oauthConfig, type OAuthProvider } from '#lib/server/oauth';

export const GET: RequestHandler = async ({ params, locals, cookies, url }) => {
  if (!locals.user) throw redirect(303, '/login');
  const organization = await organizationFor(locals.user.id);
  if (!organization || !canManageConnections(organization.role)) throw error(403, 'Only workspace owners can manage connections.');
  const provider = params.provider as OAuthProvider;
  const config = (provider === 'github' || provider === 'vercel') ? oauthConfig(provider) : undefined;
  if (!config) throw error(404, 'This provider has no OAuth sign-in configured.');
  // CSRF: the callback must return this exact value, bound to this browser.
  const state = randomBytes(24).toString('base64url');
  cookies.set(OAUTH_STATE_COOKIE, `${provider}.${state}`, { path: '/settings/connections', httpOnly: true, sameSite: 'lax', secure: hosted, maxAge: 600 });
  throw redirect(302, authorizeUrl(provider, config, url.origin, state), {
    external: [provider === 'github' ? 'https://github.com' : 'https://vercel.com'],
  });
};
