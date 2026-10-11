/** First-boot seeding: roles, settings, admin user, optional demo data. */

import { demoEntities } from '@mosaic-apps/core';
import type { Db } from './db/driver.js';
import { hashPassword } from './modules/auth.js';
import { saveEntity } from './entities/registry.js';
import { DEFAULT_ROLES } from './platform.js';
import { applyPlan } from './migrate/runner.js';
import { seedSettings } from './modules/settings.js';
import { seedDemoArtifacts } from './seed-demo.js';

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
    result.pages = artifacts.pages;
  }

  return result;
}

