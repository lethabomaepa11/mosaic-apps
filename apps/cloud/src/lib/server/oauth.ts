import type { Provider } from './providers';

/**
 * OAuth for delivery providers, so users click "Connect" instead of pasting tokens.
 * GitHub uses a GitHub OAuth App; Vercel uses a Vercel Integration. Neon only offers
 * OAuth to approved partners, so it stays on API keys. A provider without its env
 * configuration falls back to the paste-a-token form.
 */
export const OAUTH_STATE_COOKIE = 'mosaic_oauth_state';

export type OAuthProvider = Extract<Provider, 'github' | 'vercel'>;

interface OAuthConfig { clientId: string; clientSecret: string; slug?: string }

export function oauthConfig(provider: Provider): OAuthConfig | undefined {
  const env = process.env;
  if (provider === 'github' && env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET) {
    return { clientId: env.GITHUB_OAUTH_CLIENT_ID, clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET };
  }
  if (provider === 'vercel' && env.VERCEL_INTEGRATION_SLUG && env.VERCEL_INTEGRATION_CLIENT_ID && env.VERCEL_INTEGRATION_CLIENT_SECRET) {
    return { clientId: env.VERCEL_INTEGRATION_CLIENT_ID, clientSecret: env.VERCEL_INTEGRATION_CLIENT_SECRET, slug: env.VERCEL_INTEGRATION_SLUG };
  }
  return undefined;
}

export const callbackUrl = (origin: string, provider: OAuthProvider) => `${origin}/settings/connections/${provider}/callback`;

export function authorizeUrl(provider: OAuthProvider, config: OAuthConfig, origin: string, state: string): string {
  if (provider === 'github') {
    const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: callbackUrl(origin, provider), scope: 'repo', state, allow_signup: 'true' });
    return `https://github.com/login/oauth/authorize?${params}`;
  }
  // The Vercel integration's redirect URL is configured on the integration itself.
  return `https://vercel.com/integrations/${encodeURIComponent(config.slug!)}/new?${new URLSearchParams({ state })}`;
}

/** Exchanges the callback code for an access token (plus the Vercel team the user chose, if any). */
export async function exchangeCode(provider: OAuthProvider, config: OAuthConfig, origin: string, code: string): Promise<{ token: string; teamId: string | null }> {
  const redirect_uri = callbackUrl(origin, provider);
  const response = provider === 'github'
    ? await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri }), signal: AbortSignal.timeout(15_000),
      })
    : await fetch('https://api.vercel.com/v2/oauth/access_token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri }), signal: AbortSignal.timeout(15_000),
      });
  const body = await response.json().catch(() => ({})) as { access_token?: string; team_id?: string | null; error?: string; error_description?: string };
  // GitHub reports a bad code with HTTP 200 and an `error` field.
  if (!response.ok || !body.access_token) throw new Error(`${provider} sign-in failed: ${body.error_description ?? body.error ?? response.status}`);
  return { token: body.access_token, teamId: body.team_id ?? null };
}
