import { createHash, randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { deleteCookie, getSignedCookie, setCookie, setSignedCookie } from 'hono/cookie';
import type { AuthRoutesDeps } from './auth-routes.js';
import { loadAuthUser, MOSAIC_SESSION_COOKIE, signJwt, type AuthEnv } from './auth.js';
import { fail, ok } from './http.js';
import { writeAudit } from './audit.js';

const providers = {
  google: {
    label: 'Google', authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token', scope: 'openid email profile',
  },
  github: {
    label: 'GitHub', authorize: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token', scope: 'read:user user:email',
  },
} as const;
type Provider = keyof typeof providers;
export interface OAuthOptions {
  origin: string;
  google?: { clientId: string; clientSecret: string };
  github?: { clientId: string; clientSecret: string };
}

const timeout = () => AbortSignal.timeout(10_000);

async function profile(provider: Provider, token: string) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'Mosaic' };
  const get = async <T>(url: string): Promise<T> => {
    const response = await fetch(url, { headers, redirect: 'error', signal: timeout() });
    if (!response.ok) throw new Error('OAuth profile request failed');
    return await response.json() as T;
  };
  if (provider === 'google') {
    const info = await get<{ sub?: unknown; email?: unknown; email_verified?: unknown; name?: unknown }>('https://openidconnect.googleapis.com/v1/userinfo');
    return { subject: info.sub, email: info.email_verified === true ? info.email : undefined, name: info.name };
  }
  const [user, emails] = await Promise.all([
    get<{ id?: number; name?: unknown; login?: unknown }>('https://api.github.com/user'),
    get<Array<{ verified?: boolean; primary?: boolean; email?: unknown }>>('https://api.github.com/user/emails'),
  ]);
  return {
    subject: Number.isSafeInteger(user.id) ? String(user.id) : undefined,
    email: Array.isArray(emails) ? emails.find((item) => item?.verified === true && item.primary === true)?.email : undefined,
    name: user.name || user.login,
  };
}

interface Flow { state: string; verifier: string; expires: number; next: string; linkUser?: string }

export function oauthRoutes(deps: AuthRoutesDeps, options?: OAuthOptions) {
  const app = new Hono<AuthEnv>();
  const origin = options?.origin ? new URL(options.origin) : undefined;
  if (origin && (origin.origin !== options?.origin || !(origin.protocol === 'https:' || origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) {
    throw new Error('Mosaic OAuth origin must be an HTTPS origin or a localhost development origin.');
  }
  const config = (key: string) => {
    if (!deps.enabled || !origin || !Object.hasOwn(providers, key)) return undefined;
    const provider = key as Provider;
    const credentials = options?.[provider];
    if (!credentials?.clientId || !credentials.clientSecret) return undefined;
    return { provider, credentials, ...providers[provider] };
  };
  const callback = (provider: Provider) => `${origin!.origin}/api/auth/oauth/${provider}/callback`;
  const cookie = (provider: Provider) => `mosaic_oauth_${provider}`;
  const cookieOptions = { path: '/api/auth/oauth', httpOnly: true, sameSite: 'Lax' as const, secure: origin?.protocol === 'https:' };
  const safePath = (value: string | undefined) => value && /^\/(?![/\\])/.test(value) && !/[\\\u0000-\u001f]/.test(value) ? value : '/';

  app.get('/', (c) => {
    c.header('Cache-Control', 'private, no-store');
    return ok(c, {
      signedIn: Boolean(c.get('user')),
      providers: (Object.keys(providers) as Provider[]).filter((key) => config(key)).map((key) => ({ id: key, label: providers[key].label })),
    });
  });

  app.on(['GET', 'POST'], '/:provider/start', async (c) => {
    const entry = config(c.req.param('provider'));
    if (!entry) return fail(c, 404, 'This OAuth provider is unavailable', 'OAUTH_UNAVAILABLE');
    const linking = c.req.method === 'POST';
    const user = c.get('user');
    if (linking && (!user || c.req.header('Origin') !== origin!.origin)) return fail(c, 403, 'Sign in to link a provider', 'FORBIDDEN');
    const flow: Flow = {
      state: randomBytes(24).toString('base64url'), verifier: randomBytes(32).toString('base64url'),
      expires: Date.now() + 10 * 60_000, next: safePath(c.req.query('next')), linkUser: linking ? user!.id : undefined,
    };
    await setSignedCookie(c, cookie(entry.provider), JSON.stringify(flow), deps.secret, { ...cookieOptions, maxAge: 600 });
    const url = new URL(entry.authorize);
    url.search = new URLSearchParams({
      client_id: entry.credentials.clientId, redirect_uri: callback(entry.provider), scope: entry.scope,
      response_type: 'code', state: flow.state, code_challenge: createHash('sha256').update(flow.verifier).digest('base64url'), code_challenge_method: 'S256',
    }).toString();
    c.header('Cache-Control', 'private, no-store');
    return c.redirect(url.href, 303);
  });

  app.get('/:provider/callback', async (c) => {
    const entry = config(c.req.param('provider'));
    if (!entry) return fail(c, 404, 'This OAuth provider is unavailable', 'OAUTH_UNAVAILABLE');
    const raw = await getSignedCookie(c, deps.secret, cookie(entry.provider));
    deleteCookie(c, cookie(entry.provider), cookieOptions);
    c.header('Cache-Control', 'private, no-store');
    const rejected = (code: string) => c.redirect(`/login?oauth=${code}`, 303);
    const code = c.req.query('code');
    if (!raw || !code) return rejected('invalid');
    const flow = JSON.parse(raw) as Flow;
    if (flow.expires < Date.now() || flow.state !== c.req.query('state') || (flow.linkUser && c.get('user')?.id !== flow.linkUser)) return rejected('invalid');

    try {
      const response = await fetch(entry.token, {
        method: 'POST', headers: { Accept: 'application/json' }, redirect: 'error', signal: timeout(),
        body: new URLSearchParams({
          grant_type: 'authorization_code', code, redirect_uri: callback(entry.provider), code_verifier: flow.verifier,
          client_id: entry.credentials.clientId, client_secret: entry.credentials.clientSecret,
        }),
      });
      if (!response.ok) return rejected('provider');
      const { access_token: token } = await response.json() as { access_token?: unknown };
      if (typeof token !== 'string' || !token) return rejected('provider');
      const identity = await profile(entry.provider, token);
      const { subject } = identity;
      if (typeof subject !== 'string' || !subject || subject.length > 255) return rejected('provider');
      const email = typeof identity.email === 'string' ? identity.email.trim().toLowerCase() : '';
      const result = await deps.db.tx(async (tx) => {
        const params = [entry.provider, subject];
        const { rows: [linked] } = await tx.query<{ user_id: string }>('SELECT user_id FROM mosaic_oauth_identities WHERE provider = $1 AND subject = $2', params);
        if (linked) return flow.linkUser && linked.user_id !== flow.linkUser ? { error: 'linked' } : { id: linked.user_id };
        let id = flow.linkUser;
        if (!id) {
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) return { error: 'email' };
          if ((await tx.query('SELECT 1 FROM mosaic_users WHERE lower(email) = $1', [email])).rows.length) return { error: 'existing' };
          if (!deps.allowRegistration) return { error: 'closed' };
          const name = typeof identity.name === 'string' && identity.name.trim() ? identity.name.trim().slice(0, 100) : email.split('@')[0];
          const { rows: [created] } = await tx.query<{ id: string }>("INSERT INTO mosaic_users (email, name, password_hash, roles) VALUES ($1, $2, '', ARRAY['viewer']) ON CONFLICT (email) DO NOTHING RETURNING id", [email, name]);
          if (!created) return { error: 'existing' };
          id = created.id;
        }
        const inserted = await tx.query('INSERT INTO mosaic_oauth_identities (provider, subject, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING user_id', [...params, id]);
        if (!inserted.rows.length) {
          if (!flow.linkUser) throw new Error('Concurrent OAuth registration');
          return { error: 'linked' };
        }
        return { id };
      });
      if (!result.id) return rejected(result.error ?? 'provider');
      const user = await loadAuthUser(deps, result.id);
      if (!user) return rejected('closed');
      const session = signJwt({ sub: user.id, email: user.email, roles: user.roles }, deps.secret, deps.tokenTtl);
      setCookie(c, MOSAIC_SESSION_COOKIE, session, { ...cookieOptions, path: '/', maxAge: deps.tokenTtl });
      await deps.db.query('UPDATE mosaic_users SET last_login_at = now() WHERE id = $1', [user.id]);
      writeAudit(deps.db, { action: flow.linkUser ? 'oauth.link' : 'login', user });
      return c.redirect(flow.next, 303);
    } catch {
      return rejected('provider');
    }
  });
  return app;
}
