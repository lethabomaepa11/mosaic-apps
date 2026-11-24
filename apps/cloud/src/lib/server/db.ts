import { randomUUID } from 'node:crypto';
import { createDb, hashPassword, type Db } from '@mosaic-apps/server';

const env = process.env;

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
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS ui_theme text NOT NULL DEFAULT 'corporate';
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS app_framework text NOT NULL DEFAULT 'sveltekit';
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS ui_system text NOT NULL DEFAULT 'daisyui';
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS blueprint jsonb;
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS planner_model text;
ALTER TABLE cloud_projects ADD COLUMN IF NOT EXISTS planned_at timestamptz;
`;

let database: Promise<Db> | undefined;

function databaseUrl(): string {
  const value = env.CLOUD_DATABASE_URL ?? env.DATABASE_URL ?? 'pglite://./data/cloud';
  if (env.VERCEL && !/^postgres(ql)?:\/\//.test(value)) {
    throw new Error('Mosaic Cloud requires CLOUD_DATABASE_URL or DATABASE_URL on Vercel.');
  }
  return value;
}

async function initialize(): Promise<Db> {
  const db = await createDb(databaseUrl());
  for (const statement of CONTROL_DDL.split(/;\s*\n/).map((value) => value.trim()).filter(Boolean)) {
    await db.query(statement);
  }
  await bootstrap(db);
  return db;
}

async function bootstrap(db: Db): Promise<void> {
  const email = (env.CLOUD_ADMIN_EMAIL ?? (env.VERCEL ? '' : 'admin@mosaic.local')).trim().toLowerCase();
  const password = env.CLOUD_ADMIN_PASSWORD ?? (env.VERCEL ? '' : 'admin1234');
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

export function getCloudDb(): Promise<Db> {
  database ??= initialize().catch((cause) => {
    database = undefined;
    throw cause;
  });
  return database;
}

export function id(): string { return randomUUID(); }

export function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || `project-${Date.now()}`;
}
