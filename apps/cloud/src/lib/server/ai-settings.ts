import { getCloudDb } from './db';
import { decryptProviderSecret, encryptProviderSecret } from './providers';
import { AI_PROVIDERS, type AiConfig, type AiProvider } from './ai';

export const isAiProvider = (value: string): value is AiProvider => Object.hasOwn(AI_PROVIDERS, value);

/** What the settings page may show: never the key itself. */
export async function getAiSettings(userId: string): Promise<{ provider: AiProvider; model: string; hasKey: boolean }> {
  const db = await getCloudDb();
  const row = (await db.query<{ provider: string; model: string | null; secret_ciphertext: string | null }>('SELECT provider, model, secret_ciphertext FROM cloud_user_ai_settings WHERE user_id = $1', [userId])).rows[0];
  const provider = row && isAiProvider(row.provider) ? row.provider : 'mosaic';
  return { provider, model: row?.model ?? '', hasKey: Boolean(row?.secret_ciphertext) };
}

export async function saveAiSettings(userId: string, input: { provider: AiProvider; model: string; apiKey?: string }): Promise<void> {
  const db = await getCloudDb();
  const secret = input.apiKey ? encryptProviderSecret(input.apiKey) : null;
  // Keep the stored key when only the model changes for the same provider; drop it when switching provider.
  await db.query(
    `INSERT INTO cloud_user_ai_settings (user_id, provider, model, secret_ciphertext, secret_iv, secret_tag, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (user_id) DO UPDATE SET provider = EXCLUDED.provider, model = EXCLUDED.model, updated_at = now(),
       secret_ciphertext = CASE WHEN EXCLUDED.secret_ciphertext IS NOT NULL THEN EXCLUDED.secret_ciphertext WHEN cloud_user_ai_settings.provider = EXCLUDED.provider THEN cloud_user_ai_settings.secret_ciphertext END,
       secret_iv = CASE WHEN EXCLUDED.secret_iv IS NOT NULL THEN EXCLUDED.secret_iv WHEN cloud_user_ai_settings.provider = EXCLUDED.provider THEN cloud_user_ai_settings.secret_iv END,
       secret_tag = CASE WHEN EXCLUDED.secret_tag IS NOT NULL THEN EXCLUDED.secret_tag WHEN cloud_user_ai_settings.provider = EXCLUDED.provider THEN cloud_user_ai_settings.secret_tag END`,
    [userId, input.provider, input.model || null, secret?.ciphertext ?? null, secret?.iv ?? null, secret?.tag ?? null],
  );
}

/** The AI a job runs on: the requesting user's own provider when configured, else Mosaic's default. */
export async function aiConfigFor(userId: string | undefined): Promise<AiConfig> {
  if (!userId) return { provider: 'mosaic' };
  const db = await getCloudDb();
  const row = (await db.query<{ provider: string; model: string | null; secret_ciphertext: string | null; secret_iv: string | null; secret_tag: string | null }>(
    'SELECT provider, model, secret_ciphertext, secret_iv, secret_tag FROM cloud_user_ai_settings WHERE user_id = $1', [userId],
  )).rows[0];
  if (!row || !isAiProvider(row.provider) || row.provider === 'mosaic' || !row.secret_ciphertext || !row.secret_iv || !row.secret_tag) return { provider: 'mosaic' };
  return { provider: row.provider, model: row.model ?? undefined, apiKey: decryptProviderSecret({ ciphertext: row.secret_ciphertext, iv: row.secret_iv, tag: row.secret_tag }) };
}
