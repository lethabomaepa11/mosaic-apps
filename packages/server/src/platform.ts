/** Bootstrap DDL for Mosaic platform tables (idempotent). */

import type { Db } from './db/driver.js';

export const PLATFORM_DDL = `
CREATE TABLE IF NOT EXISTS mosaic_entities (
  name        text PRIMARY KEY,
  definition  jsonb NOT NULL,
  version     integer NOT NULL DEFAULT 1,
  source      text NOT NULL DEFAULT 'database',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mosaic_entity_columns (
  entity_name text NOT NULL,
  column_name text NOT NULL,
  PRIMARY KEY (entity_name, column_name)
);

CREATE TABLE IF NOT EXISTS mosaic_migrations (
  id            text PRIMARY KEY,
  entity        text NOT NULL,
  entity_version integer NOT NULL DEFAULT 1,
  checksum      text NOT NULL,
  statements    jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings      jsonb NOT NULL DEFAULT '[]'::jsonb,
  status        text NOT NULL DEFAULT 'applied',
  error         text,
  applied_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mosaic_migrations_entity_idx ON mosaic_migrations (entity, applied_at DESC);

CREATE TABLE IF NOT EXISTS mosaic_forms (
  id          text PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  folder      text,
  entity      text,
  version     integer NOT NULL DEFAULT 1,
  published   boolean NOT NULL DEFAULT false,
  schema      jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_source jsonb,
  settings    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mosaic_form_versions (
  id           text PRIMARY KEY,
  form_id      text NOT NULL,
  version      integer NOT NULL,
  snapshot     jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mosaic_form_versions_form_idx ON mosaic_form_versions (form_id, version DESC);

CREATE TABLE IF NOT EXISTS mosaic_pages (
  id          text PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  route       text NOT NULL DEFAULT '/',
  name        text NOT NULL,
  description text,
  folder      text,
  version     integer NOT NULL DEFAULT 1,
  published   boolean NOT NULL DEFAULT false,
  schema      jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mosaic_page_versions (
  id text PRIMARY KEY,
  page_id text NOT NULL,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);

CREATE TABLE IF NOT EXISTS mosaic_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  roles         text[] NOT NULL DEFAULT '{}',
  disabled      boolean NOT NULL DEFAULT false,
  avatar_color  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS mosaic_roles (
  name         text PRIMARY KEY,
  display_name text,
  description  text,
  permissions  text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS mosaic_audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action     text NOT NULL,
  entity     text,
  record_id  text,
  changes    jsonb,
  user_id    uuid,
  user_email text,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mosaic_audit_log_created_idx ON mosaic_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS mosaic_audit_log_entity_idx ON mosaic_audit_log (entity, created_at DESC);

CREATE TABLE IF NOT EXISTS mosaic_ref_lists (
  id         text PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  label      text,
  items      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mosaic_settings (
  key        text PRIMARY KEY,
  value      jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mosaic_forms ADD COLUMN IF NOT EXISTS folder text;
ALTER TABLE mosaic_pages ADD COLUMN IF NOT EXISTS folder text;

CREATE TABLE IF NOT EXISTS mosaic_files (
  id          text PRIMARY KEY,
  filename    text NOT NULL,
  mime        text,
  size        bigint NOT NULL DEFAULT 0,
  path        text NOT NULL,
  uploaded_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
`;

export async function ensurePlatformTables(db: Db): Promise<void> {
  // PGlite (and the pg extended protocol) cannot run several statements in one
  // prepared query — split the bootstrap DDL and execute each statement.
  const statements = PLATFORM_DDL.split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sql of statements) {
    await db.query(sql);
  }
}

/** Well-known default roles seeded on first boot. */
export const DEFAULT_ROLES = [
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full access to everything',
    permissions: ['*'],
  },
  {
    name: 'editor',
    displayName: 'Editor',
    description: 'Create and update records, manage forms and pages',
    permissions: ['entity:*:read', 'entity:*:create', 'entity:*:update', 'forms:manage', 'pages:manage'],
  },
  {
    name: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access',
    permissions: ['entity:*:read'],
  },
] as const;

/** Reserved entity names that would collide with platform routes. */
export const RESERVED_ENTITY_NAMES = new Set([
  'auth', 'forms', 'pages', 'users', 'roles', 'settings', 'audit', 'reflists',
  'ref-lists', 'files', 'migrations', 'meta', 'health', 'entities', 'openapi',
]);
