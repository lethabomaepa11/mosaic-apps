import { randomBytes } from 'node:crypto';
import { registerAccount } from './auth';
import { getCloudDb } from './db';
import { exchangeCode, oauthConfig } from './oauth';

/**
 * "Continue with GitHub" for Mosaic Cloud accounts. It reuses the GitHub OAuth App used for
 * repository connections (register its callback URL as the site origin so both
 * /auth/github/callback and /settings/connections/github/callback are accepted), but only
 * asks for profile + email here; repository access is a separate, explicit connection.
 */
export const githubLoginEnabled = () => Boolean(oauthConfig('github'));
export const GITHUB_LOGIN_STATE = 'mosaic_github_login_state';
export const loginCallback = (origin: string) => `${origin}/auth/github/callback`;

export function githubLoginUrl(origin: string, state: string): string {
  const config = oauthConfig('github')!;
  return `https://github.com/login/oauth/authorize?${new URLSearchParams({ client_id: config.clientId, redirect_uri: loginCallback(origin), scope: 'read:user user:email', state, allow_signup: 'true' })}`;
}

async function github<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'Mosaic-Cloud' }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`GitHub ${path} failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function signInWithGitHub(origin: string, code: string): Promise<{ id: string; email: string; name: string }> {
  const { token } = await exchangeCode('github', oauthConfig('github')!, origin, code, loginCallback(origin));
  const profile = await github<{ id: number; login: string; name: string | null }>('/user', token);
  const emails = await github<Array<{ email: string; primary: boolean; verified: boolean }>>('/user/emails', token);
  const email = (emails.find((item) => item.primary && item.verified) ?? emails.find((item) => item.verified))?.email?.toLowerCase();
  if (!email) throw new Error('Your GitHub account has no verified email address.');
  const db = await getCloudDb();
  const githubId = String(profile.id);
  const linked = await db.query<{ id: string; email: string; name: string }>('SELECT id, email, name FROM cloud_users WHERE github_id = $1', [githubId]);
  if (linked.rows[0]) return linked.rows[0];
  // Only a verified GitHub email may claim an existing account with the same address.
  const existing = await db.query<{ id: string; email: string; name: string }>('SELECT id, email, name FROM cloud_users WHERE lower(email) = $1', [email]);
  if (existing.rows[0]) {
    await db.query('UPDATE cloud_users SET github_id = $2 WHERE id = $1', [existing.rows[0].id, githubId]);
    return existing.rows[0];
  }
  // GitHub-only accounts get an unguessable password; they sign in with GitHub.
  const created = await registerAccount(profile.name?.trim() || profile.login, email, randomBytes(32).toString('base64url'));
  if (!created) throw new Error('Could not create the account.');
  await db.query('UPDATE cloud_users SET github_id = $2 WHERE id = $1', [created.id, githubId]);
  return created;
}
