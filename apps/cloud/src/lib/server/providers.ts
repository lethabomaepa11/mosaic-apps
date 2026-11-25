import { hosted } from './db';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const PROVIDERS = ['github', 'vercel', 'neon'] as const;
export type Provider = typeof PROVIDERS[number];
export const VERCEL_RECONNECT = 'Reconnect Vercel in Settings → Connections. Your Cloud session and existing projects are kept.';

export class VercelCredentialError extends Error {
  constructor() { super(VERCEL_RECONNECT); }
}

export function vercelCredentialRejected(status: number, code: unknown, message: unknown) {
  return status === 401 || status === 403 && (String(message ?? '').trim().toLowerCase() === 'not authorized'
    || /(?:invalid|expired|revoked)[ _-]*(?:access[ _-]*)?token|token[ _-]*(?:is[ _-]*)?(?:invalid|expired|revoked)/i.test(`${code ?? ''} ${message ?? ''}`));
}

export async function verifyVercelConnection(token: string, teamId?: string | null) {
  const url = new URL('https://api.vercel.com/v9/projects?limit=1');
  if (teamId) url.searchParams.set('teamId', teamId);
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  const body = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
  if (vercelCredentialRejected(response.status, body.error?.code, body.error?.message)) throw new VercelCredentialError();
  if (!response.ok) throw new Error(`Vercel could not list projects for this connection (${response.status}).`);
}

function encryptionKey(): Buffer {
  const configured = process.env.CLOUD_PROVIDER_SECRET_KEY?.trim();
  if (!configured) {
    if (hosted) throw new Error('CLOUD_PROVIDER_SECRET_KEY is required in production.');
    return createHash('sha256').update('mosaic-cloud-local-provider-key').digest();
  }
  const key = Buffer.from(configured, 'base64url');
  if (key.length !== 32) throw new Error('CLOUD_PROVIDER_SECRET_KEY must be a base64url-encoded 32-byte key.');
  return key;
}

export function encryptProviderSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64url'), iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') };
}

export function decryptProviderSecret(value: { ciphertext: string; iv: string; tag: string }): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(value.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

async function providerRequest(url: string, token: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`The provider rejected this credential (${response.status}).`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function validateProviderCredential(provider: Provider, token: string): Promise<{ label: string; metadata: Record<string, unknown> }> {
  if (provider === 'github') {
    const result = await providerRequest('https://api.github.com/user', token, {
      'x-github-api-version': '2026-03-10', accept: 'application/vnd.github+json', 'user-agent': 'Mosaic-Cloud',
    });
    const login = String(result.login ?? 'GitHub account');
    return { label: login, metadata: { accountId: result.id, login, avatarUrl: result.avatar_url ?? null } };
  }
  if (provider === 'vercel') {
    const result = await providerRequest('https://api.vercel.com/v2/user', token);
    const user = (result.user ?? result) as Record<string, unknown>;
    const label = String(user.username ?? user.name ?? user.email ?? 'Vercel account');
    return { label, metadata: { accountId: user.id, username: user.username ?? null, email: user.email ?? null } };
  }
  const result = await providerRequest('https://console.neon.tech/api/v2/projects', token);
  const projects = Array.isArray(result.projects) ? result.projects : [];
  return { label: 'Neon account', metadata: { projectCount: projects.length } };
}

export function isProvider(value: string): value is Provider {
  return PROVIDERS.includes(value as Provider);
}
