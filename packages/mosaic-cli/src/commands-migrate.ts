/** Project commands: migrate + seed. */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { applyPlan, computePlan, createDb, ensurePlatformTables, seedPlatform, syncEntitiesDir } from '@mosaic/server';
import { loadProjectConfig } from './project.js';

export async function migrate(opts: { dir: string; allowDestructive: boolean; dryRun: boolean }): Promise<void> {
  const config = await loadProjectConfig(opts.dir);
  const db = await createDb(config.databaseUrl);
  try {
    await ensurePlatformTables(db);
    const entitiesDir = join(opts.dir, 'apps', 'api', 'entities');
    if (existsSync(entitiesDir)) await syncEntitiesDir(db, entitiesDir);
    const plan = await computePlan(db);
    if (plan.statements.length === 0) {
      console.log('✓ Schema is up to date — nothing to migrate.');
      return;
    }
    console.log('\nPlanned migration:\n');
    for (const s of plan.statements) {
      const tag = s.risk === 'destructive' ? '⚠ DESTRUCTIVE' : ' ';
      console.log(`  [${tag}] ${s.description}`);
      console.log(`      ${s.sql}`);
    }
    if (plan.warnings.length) {
      console.log('\nWarnings:');
      for (const w of plan.warnings) console.log(`  • ${w}`);
    }
    if (opts.dryRun) {
      console.log('\n(dry run — nothing applied; rerun without --dry-run)');
      return;
    }
    console.log('');
    const result = await applyPlan(db, { allowDestructive: opts.allowDestructive });
    const total = result.applied.reduce((n, a) => n + a.statements, 0);
    console.log(`✓ Applied ${total} statement(s) across ${result.applied.length} entity table(s).`);
    for (const a of result.applied) console.log(`    ${a.entity}: ${a.statements} statement(s)`);
    if (result.warnings.length) {
      console.log('Warnings:');
      for (const w of result.warnings) console.log(`  • ${w}`);
    }
  } finally {
    await db.close();
  }
}

export async function seed(opts: { dir: string; demo: boolean }): Promise<void> {
  const config = await loadProjectConfig(opts.dir);
  const db = await createDb(config.databaseUrl);
  try {
    await ensurePlatformTables(db);
    const result = await seedPlatform(db, {
      admin: { email: 'admin@mosaic.local', password: 'admin1234', name: 'Administrator' },
      demo: opts.demo,
    });
    console.log(
      `✓ Seeded: ${result.roles} roles, settings, ${result.adminCreated ? 'admin user, ' : ''}` +
        `${result.entities} demo entities, ${result.forms} forms, ${result.pages} pages.`,
    );
  } finally {
    await db.close();
  }
}
