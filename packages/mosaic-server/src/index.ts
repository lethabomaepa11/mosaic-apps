/** Public entry point for @mosaic/server. */

export { createMosaicApp, createMosaicServer, type MosaicServer, type MosaicServerConfig } from './app.js';
export { createPgDriver, ident, type Db } from './db/driver.js';
export { createPgliteDriver, isPgliteUrl } from './db/pglite.js';
import type { Db as DbType } from './db/driver.js';

/** Connect to either driver by URL convention (pglite://... or postgres://...). */
export async function createDb(url: string): Promise<DbType> {
  const { isPgliteUrl: isPglite, createPgliteDriver: pglite } = await import('./db/pglite.js');
  const { createPgDriver: pg } = await import('./db/driver.js');
  return isPglite(url) ? pglite(url) : pg(url);
}
export { introspectTables, type SchemaSnapshot, type TableInfo } from './db/introspect.js';
export { diffEntities, diffEntity, checksumStatements, type DiffResult } from './migrate/engine.js';
export { applyPlan, computePlan, migrationHistory } from './migrate/runner.js';
export {
  listEntities,
  getEntity,
  saveEntity,
  deleteEntity,
  syncEntitiesDir,
  assertValidEntity,
  EntityRegistryError,
} from './entities/registry.js';
export { buildEntitySchema, formatIssues } from './validation/zod.js';
export { buildWhere, buildListSql, buildInsertSql, buildUpdateSql, buildOptionsSql, QueryError } from './crud/sql.js';
export { crudRoutes } from './crud/router.js';
export { hashPassword, verifyPassword, signJwt, verifyJwt, type AuthUser, type AuthEnv } from './modules/auth.js';
export { canAccessEntity, hasPermission, isAdmin, requirePermission } from './modules/rbac.js';
export { writeAudit, auditRoutes } from './modules/audit.js';
export { artifactRoutes } from './modules/artifacts.js';
export { settingsRoutes, seedSettings, DEFAULT_SETTINGS } from './modules/settings.js';
export { refListRoutes } from './modules/reflists.js';
export { userAdminRoutes, roleAdminRoutes } from './modules/users.js';
export { migrationRoutes } from './modules/migrations-routes.js';
export { fileRoutes } from './modules/files.js';
export { metaRoutes, PLATFORM_VERSION } from './modules/meta.js';
export { authRoutes } from './modules/auth-routes.js';
export { entityAdminRoutes } from './modules/entity-admin.js';
export { seedPlatform, type SeedOptions, type SeedResult } from './seed.js';
export { ensurePlatformTables, DEFAULT_ROLES, RESERVED_ENTITY_NAMES, PLATFORM_DDL } from './platform.js';
export { HttpError, fail, ok, readJson, mapDbError } from './modules/http.js';
export {
  extractEntityDef,
  loadEntitiesFromDir,
  loadEntityDefs,
  loadEntityJsonDefs,
  autoRegisterEntities,
  importEntityModule,
  registerEntity,
  getEntityClass,
  Entity,
  Field,
  Relation,
  type EntityClass,
  type EntityOptions,
  type FieldOptions,
  type RelationOptions,
} from '@mosaic-apps/mosaic-core';

