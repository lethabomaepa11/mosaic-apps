/** First-boot seeding: roles, settings, admin user, optional demo data. */

import { demoEntities } from '@mosaic-apps/core';
import type { Db } from './db/driver.js';
import { hashPassword } from './modules/auth.js';
import { saveEntity } from './entities/registry.js';
import { DEFAULT_ROLES } from './platform.js';
import { applyPlan } from './migrate/runner.js';
import { seedSettings } from './modules/settings.js';
import { seedDemoArtifacts } from './seed-demo.js';
import { recordRevision } from './modules/revisions.js';

export interface SeedOptions {
  admin?: { email: string; password: string; name?: string };
  /** register demo entities + apply migrations + demo forms/pages */
  demo?: boolean;
}

export interface SeedResult {
  roles: number;
  settings: number;
  adminCreated: boolean;
  entities: number;
  migrations: number;
  forms: number;
  pages: number;
}

export async function seedPlatform(db: Db, opts: SeedOptions = {}): Promise<SeedResult> {
  const result: SeedResult = {
    roles: 0,
    settings: 0,
    adminCreated: false,
    entities: 0,
    migrations: 0,
    forms: 0,
    pages: 0,
  };

  for (const role of DEFAULT_ROLES) {
    await db.query(
      `INSERT INTO mosaic_roles (name, display_name, description, permissions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO NOTHING`,
      [role.name, role.displayName, role.description, [...role.permissions]],
    );
    result.roles++;
  }

  await seedSettings(db);
  result.settings = 1;

  const home = await db.query<Record<string, unknown>>(
    `INSERT INTO mosaic_pages (id, slug, route, name, description, version, published, schema, settings)
     SELECT 'pg_home', 'home', '/', 'Home', 'Welcome page', 1, true, $1::jsonb, $2::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM mosaic_pages WHERE route = '/')
     RETURNING id, slug, route, name, description, folder, version, published, schema, settings, created_at, updated_at`,
    [
      JSON.stringify({ id: 'pg_home_root', type: 'page', children: [
        { id: 'pg_home_title', type: 'heading', props: { text: 'Welcome', level: 1 } },
        { id: 'pg_home_intro', type: 'text', props: { text: 'Build this page in Mosaic Studio.', muted: true } },
      ] }),
      JSON.stringify({ title: 'Home', description: 'Welcome page', layout: 'default' }),
    ],
  );
  if (home.rows[0]) {
    await recordRevision(db, {
      kind: 'page', artifactId: 'pg_home', revision: 1, snapshot: home.rows[0],
      message: 'Create starter home page', origin: 'system',
    });
    result.pages += 1;
  }

  const notFound = await db.query<Record<string, unknown>>(
    `INSERT INTO mosaic_pages (id, slug, route, name, description, version, published, schema, settings)
     SELECT 'pg_not_found', 'not-found', '/404', 'Not found', 'Page not found', 1, true, $1::jsonb, $2::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM mosaic_pages WHERE route = '/404')
     RETURNING id, slug, route, name, description, folder, version, published, schema, settings, created_at, updated_at`,
    [
      JSON.stringify({ id: 'pg_not_found_root', type: 'page', children: [
        { id: 'pg_not_found_title', type: 'heading', props: { text: 'Page not found', level: 1 } },
        { id: 'pg_not_found_intro', type: 'text', props: { text: 'The page you requested does not exist.' } },
      ] }),
      JSON.stringify({ title: 'Page not found', layout: 'bare', menu: { show: false }, seo: { robots: 'noindex,nofollow' } }),
    ],
  );
  if (notFound.rows[0]) {
    await recordRevision(db, {
      kind: 'page', artifactId: 'pg_not_found', revision: 1, snapshot: notFound.rows[0],
      message: 'Create starter not-found page', origin: 'system',
    });
    result.pages += 1;
  }

  if (opts.admin) {
    const existing = await db.query('SELECT 1 FROM mosaic_users WHERE lower(email) = $1', [opts.admin.email.toLowerCase()]);
    if (!existing.rows.length) {
      await db.query(
        `INSERT INTO mosaic_users (email, name, password_hash, roles, avatar_color)
         VALUES ($1, $2, $3, $4, '#6366f1')`,
        [opts.admin.email.toLowerCase(), opts.admin.name ?? 'Administrator', hashPassword(opts.admin.password), ['admin']],
      );
      result.adminCreated = true;
    }
  }

  if (opts.demo) {
    for (const entity of demoEntities) {
      await saveEntity(db, entity, 'database');
      result.entities++;
    }
    const applied = await applyPlan(db, { allowDestructive: true });
    result.migrations = applied.applied.length;
    const artifacts = await seedDemoArtifacts(db);
    result.forms = artifacts.forms;
    result.pages += artifacts.pages;
  }

  return result;
}

