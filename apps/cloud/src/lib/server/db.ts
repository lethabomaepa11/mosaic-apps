import { randomUUID } from 'node:crypto';
import { createDb, createPgDriver, hashPassword, type Db } from '@mosaic-apps/server';

const env = process.env;

/** Built servers on any host refuse local defaults; only `vite dev` and tests get them. */
export const hosted = Boolean(env.VERCEL) || (typeof import.meta.env === 'object' ? !import.meta.env.DEV : env.NODE_ENV === 'production');

// `vite dev` does not put .env into process.env; load it locally (never under tests, which pin their own env).
if (!hosted && !env.NODE_TEST_CONTEXT) {
  try { process.loadEnvFile('.env'); } catch { /* no local .env */ }
}

const CONTROL_DDL = `
CREATE TABLE IF NOT EXISTS cloud_users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
  password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cloud_organizations (
  id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cloud_memberships (
  organization_id uuid NOT NULL REFERENCES cloud_organizations(id),
  user_id uuid NOT NULL REFERENCES cloud_users(id), role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (organization_id, user_id)
);
CREATE TABLE IF NOT EXISTS cloud_projects (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES cloud_organizations(id),
  name text NOT NULL, slug text NOT NULL,
  prompt text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'draft',
  include_home boolean NOT NULL DEFAULT true, include_login boolean NOT NULL DEFAULT true,
  app_framework text NOT NULL DEFAULT 'sveltekit', ui_system text NOT NULL DEFAULT 'daisyui',
  ui_theme text NOT NULL DEFAULT 'corporate',
  blueprint jsonb, planner_model text, planned_at timestamptz,
  github_repository text, vercel_project_id text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE TABLE IF NOT EXISTS cloud_environments (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES cloud_projects(id),
  name text NOT NULL, kind text NOT NULL,
  status text NOT NULL DEFAULT 'not_configured', url text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);
CREATE TABLE IF NOT EXISTS cloud_jobs (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES cloud_projects(id),
  kind text NOT NULL, status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0, stage text, error text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS cloud_releases (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES cloud_projects(id),
  version integer NOT NULL, status text NOT NULL DEFAULT 'ready', checksum text NOT NULL,
  file_count integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);
CREATE TABLE IF NOT EXISTS cloud_release_files (
  release_id uuid NOT NULL REFERENCES cloud_releases(id) ON DELETE CASCADE,
  path text NOT NULL, content text NOT NULL, mode text NOT NULL DEFAULT '100644',
  PRIMARY KEY (release_id, path)
);
CREATE TABLE IF NOT EXISTS cloud_conversations (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES cloud_projects(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cloud_messages (
  id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES cloud_conversations(id),
  role text NOT NULL, content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cloud_provider_connections (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES cloud_organizations(id),
  provider text NOT NULL, label text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected', secret_ciphertext text, secret_iv text, secret_tag text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id, provider, label)
);
CREATE TABLE IF NOT EXISTS cloud_audit_log (
  id uuid PRIMARY KEY, organization_id uuid REFERENCES cloud_organizations(id),
  user_id uuid REFERENCES cloud_users(id), action text NOT NULL,
  target_type text, target_id text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cloud_projects_org_idx ON cloud_projects (organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS cloud_jobs_project_idx ON cloud_jobs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cloud_releases_project_idx ON cloud_releases (project_id, version DESC);
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS ui_theme text NOT NULL DEFAULT 'corporate';
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS app_framework text NOT NULL DEFAULT 'sveltekit';
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS ui_system text NOT NULL DEFAULT 'daisyui';
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS blueprint jsonb;
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS planner_model text;
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS planned_at timestamptz;
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS neon_project_id text;
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS app_spec jsonb;
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS deploy_secret jsonb;
ALTER TABLE cloud_releases ADD COLUMN IF NOT EXISTS framework_version text;
ALTER TABLE cloud_users ADD COLUMN IF NOT EXISTS github_id text;
CREATE TABLE IF NOT EXISTS cloud_user_ai_settings (
  user_id uuid PRIMARY KEY REFERENCES cloud_users(id) ON DELETE CASCADE, provider text NOT NULL, model text,
  secret_ciphertext text, secret_iv text, secret_tag text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cloud_users_github_idx ON cloud_users (github_id) WHERE github_id IS NOT NULL;
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS database_secret jsonb;
ALTER TABLE cloud_jobs ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE cloud_jobs ADD COLUMN IF NOT EXISTS run_after timestamptz NOT NULL DEFAULT now();
ALTER TABLE cloud_jobs ADD COLUMN IF NOT EXISTS log jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE cloud_jobs ADD COLUMN IF NOT EXISTS lease_id uuid;
ALTER TABLE cloud_jobs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS cloud_jobs_queue_idx ON cloud_jobs (status, run_after);
CREATE TABLE IF NOT EXISTS cloud_preview_cleanup (
  project_id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cloud_pending_projects (
  id uuid PRIMARY KEY, input jsonb NOT NULL, expires_at timestamptz NOT NULL
);
`;

// Kept on globalThis so a dev hot-reload of this module reuses the open database: a second
// embedded PGlite instance on the same data directory corrupts it.
const cache = globalThis as typeof globalThis & { __mosaicCloudDb?: Promise<Db>; __mosaicCloudDdl?: Promise<void> };

function databaseUrl(): string {
  const value = env.CLOUD_DATABASE_URL ?? env.DATABASE_URL ?? 'pglite://./data/cloud';
  if (hosted && !/^postgres(ql)?:\/\//.test(value)) {
    throw new Error('Mosaic Cloud requires a PostgreSQL CLOUD_DATABASE_URL or DATABASE_URL when hosted.');
  }
  return value;
}

async function applyDdl(db: Db): Promise<void> {
  for (const statement of CONTROL_DDL.split(/;\s*\n/).map((value) => value.trim()).filter(Boolean)) {
    await db.query(statement);
  }
}

async function initialize(): Promise<Db> {
  const url = databaseUrl();
  const db = hosted ? createPgDriver(url, { max: 2, connectionTimeoutMillis: 12_000, idleTimeoutMillis: 5_000 }) : await createDb(url);
  try {
    await applyDdl(db);
    await bootstrap(db);
    return db;
  } catch (cause) {
    await db.close().catch(() => {});
    throw cause;
  }
}

export function transientCloudDbError(cause: unknown): boolean {
  if (!(cause instanceof Error)) return false;
  const code = (cause as NodeJS.ErrnoException).code;
  return ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', '57P01', '53300', '08006'].includes(code ?? '')
    || /timeout exceeded when trying to connect|connection terminated unexpectedly/i.test(cause.message);
}

/** Retrying a read is safe when a connection drops between serverless requests. */
export async function readCloud<T>(query: (db: Db) => Promise<T>): Promise<T> {
  try { return await query(await getCloudDb()); } catch (cause) {
    if (!transientCloudDbError(cause)) throw cause;
    await new Promise((resolve) => setTimeout(resolve, 200));
    return query(await getCloudDb());
  }
}

// Each evaluation of this module (a dev hot reload included) re-applies the idempotent DDL
// to the shared database, so new columns exist without restarting the server.
const ddlForThisModule = { done: false };

async function bootstrap(db: Db): Promise<void> {
  const email = (env.CLOUD_ADMIN_EMAIL ?? (hosted ? '' : 'admin@mosaic.local')).trim().toLowerCase();
  const password = env.CLOUD_ADMIN_PASSWORD ?? (hosted ? '' : 'admin1234');
  if (!email || password.length < 8) return;
  const existing = await db.query<{ id: string }>('SELECT id FROM cloud_users WHERE email = $1', [email]);
  if (existing.rows.length) return;
  const userId = randomUUID();
  const organizationId = randomUUID();
  await db.tx(async (tx) => {
    await tx.query('INSERT INTO cloud_users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)', [
      userId, email, env.CLOUD_ADMIN_NAME ?? 'Mosaic Admin', hashPassword(password),
    ]);
    await tx.query('INSERT INTO cloud_organizations (id, name, slug) VALUES ($1, $2, $3)', [
      organizationId, env.CLOUD_ORGANIZATION_NAME ?? 'My workspace', `workspace-${organizationId.slice(0, 8)}`,
    ]);
    await tx.query('INSERT INTO cloud_memberships (organization_id, user_id, role) VALUES ($1, $2, $3)', [organizationId, userId, 'owner']);
  });
}

export async function getCloudDb(): Promise<Db> {
  if (!cache.__mosaicCloudDb) {
    ddlForThisModule.done = true;
    cache.__mosaicCloudDb = initialize().catch((cause) => {
      cache.__mosaicCloudDb = undefined;
      throw cause;
    });
  } else if (!hosted && !ddlForThisModule.done) {
    ddlForThisModule.done = true;
    const db = cache.__mosaicCloudDb;
    cache.__mosaicCloudDdl = db.then(applyDdl).catch((cause) => {
      ddlForThisModule.done = false;
      cache.__mosaicCloudDdl = undefined;
      throw cause;
    });
  }
  const db = await cache.__mosaicCloudDb;
  await cache.__mosaicCloudDdl;
  return db;
}

export function id(): string { return randomUUID(); }

export function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || `project-${Date.now()}`;
}
