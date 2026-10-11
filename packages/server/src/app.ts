/** createMosaicServer(): wires the full Hono API from metadata + config. */

import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { EntityDef } from '@mosaic-apps/core';
import { createPgDriver, type Db } from './db/driver.js';
import { createPgliteDriver, isPgliteUrl } from './db/pglite.js';
import { ensurePlatformTables } from './platform.js';
import { listEntities, syncEntitiesDir } from './entities/registry.js';
import { resolveUser, type AuthEnv } from './modules/auth.js';
import { authRoutes } from './modules/auth-routes.js';
import { crudRoutes } from './crud/router.js';
import { entityAdminRoutes } from './modules/entity-admin.js';
import { artifactRoutes } from './modules/artifacts.js';
import { navRoutes, settingsRoutes, themeRoutes } from './modules/settings.js';
import { refListRoutes } from './modules/reflists.js';
import { roleAdminRoutes, userAdminRoutes } from './modules/users.js';
import { migrationRoutes } from './modules/migrations-routes.js';
import { auditRoutes } from './modules/audit.js';
import { fileRoutes } from './modules/files.js';
import { metaRoutes, PLATFORM_VERSION } from './modules/meta.js';
import { seedPlatform, type SeedOptions } from './seed.js';
import { HttpError, fail, mapDbError } from './modules/http.js';
import { QueryError } from './crud/sql.js';
import { endpointRegistryRoutes } from './endpoints/registry.js';

export interface MosaicServerConfig {
  databaseUrl: string;
  auth?: {
    enabled?: boolean;
    jwtSecret?: string;
    tokenTtlSeconds?: number;
    allowRegistration?: boolean;
  };
  /** Enable/disable CORS, or restrict browser access to an explicit origin list. */
  cors?: boolean | { origins: string[] };
  /** directory scanned for entity classes (`*.entity.ts`) and `*.entity.json` at boot */
  entitiesDir?: string;
  uploadsDir?: string;
  publicFiles?: boolean;
  /** `true` seeds default admin + demo data; or pass explicit options */
  seed?: SeedOptions | boolean;
  log?: boolean;
}

export interface MosaicServer {
  app: Hono<AuthEnv>;
  db: Db;
  jwtSecret: string;
  authEnabled: boolean;
  close: () => Promise<void>;
}

const DEFAULT_SEED: SeedOptions = {
  admin: { email: 'admin@mosaic.local', password: 'admin1234', name: 'Mosaic Admin' },
  demo: true,
};

export async function createMosaicServer(config: MosaicServerConfig): Promise<MosaicServer> {
  const db = isPgliteUrl(config.databaseUrl)
    ? await createPgliteDriver(config.databaseUrl)
    : createPgDriver(config.databaseUrl);
  await ensurePlatformTables(db);

  const authEnabled = config.auth?.enabled ?? true;
  const jwtSecret = config.auth?.jwtSecret ?? process.env.MOSAIC_JWT_SECRET ?? randomBytes(32).toString('hex');
  const tokenTtl = config.auth?.tokenTtlSeconds ?? 60 * 60 * 12;
  const allowRegistration = config.auth?.allowRegistration ?? false;
  const uploadsDir = config.uploadsDir ?? './uploads';

  if (config.seed) {
    const opts = config.seed === true ? DEFAULT_SEED : config.seed;
    await seedPlatform(db, opts);
  }
  if (config.entitiesDir) await syncEntitiesDir(db, config.entitiesDir);

  // ---- entity registry cache ----
  let registry = new Map<string, EntityDef>();
  const reloadRegistry = async (): Promise<void> => {
    const rows = await listEntities(db);
    registry = new Map(rows.map((r) => [r.name, r.definition]));
  };
  await reloadRegistry();
  const resolveEntity = (name: string): EntityDef | undefined => registry.get(name);

  const app = new Hono<AuthEnv>();

  if (config.cors !== false) {
    const allowedOrigins = typeof config.cors === 'object' ? config.cors.origins : undefined;
    app.use(
      '*',
      cors({
        origin: allowedOrigins?.length ? allowedOrigins : '*',
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: 86400,
      }),
    );
  }

  app.use('*', resolveUser({ db, secret: jwtSecret, enabled: authEnabled }));

  app.get('/', (c) =>
    c.json({
      name: 'Mosaic API',
      version: PLATFORM_VERSION,
      endpoints: {
        health: '/api/health',
        meta: '/api/meta',
        auth: '/api/auth/login',
        entities: '/api/entities',
        forms: '/api/forms',
        pages: '/api/pages',
        migrations: '/api/migrations/plan',
        settings: '/api/settings',
        nav: '/api/nav',
        theme: '/api/theme',
        refLists: '/api/ref-lists',
        users: '/api/users',
        roles: '/api/roles',
        audit: '/api/audit',
        files: '/api/files',
      },
    }),
  );

  // ---- modules ----
  app.route('/api/auth', authRoutes({ db, secret: jwtSecret, enabled: authEnabled, tokenTtl, allowRegistration }));
  app.route('/api/entities', crudRoutes({ db, authEnabled, resolveEntity }));
  app.route('/api/entities', entityAdminRoutes(db, reloadRegistry));
  app.route('/api/forms', artifactRoutes({ db, kind: 'form', managePerm: 'forms:manage' }));
  app.route('/api/pages', artifactRoutes({ db, kind: 'page', managePerm: 'pages:manage' }));
  app.route('/api/settings', settingsRoutes(db));
  app.route('/api/nav', navRoutes(db));
  app.route('/api/theme', themeRoutes(db));
  app.route('/api/ref-lists', refListRoutes(db));
  app.route('/api/users', userAdminRoutes(db));
  app.route('/api/roles', roleAdminRoutes(db));
  app.route('/api/migrations', migrationRoutes(db));
  app.route('/api/audit', auditRoutes(db));
  app.route('/api/files', fileRoutes({ db, uploadsDir, publicRead: config.publicFiles ?? false }));
  app.route('/files', fileRoutes({ db, uploadsDir, publicRead: config.publicFiles ?? true }));
  app.route('/api/endpoints', endpointRegistryRoutes(db));
  app.route('/api', metaRoutes(db));

  app.notFound((c) => fail(c, 404, `No route for ${c.req.method} ${c.req.path}`, 'NOT_FOUND'));

  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.message, err.code, err.details);
    if (err instanceof QueryError) return fail(c, 400, err.message, err.code);
    const mapped = mapDbError(err);
    if (mapped) return fail(c, mapped.status, mapped.message, mapped.code);
    console.error('[mosaic] unhandled error:', err);
    return fail(c, 500, 'Internal server error', 'INTERNAL');
  });

  if (config.log) {
    console.log(`[mosaic] API ready (auth: ${authEnabled ? 'on' : 'off'}, entities: ${registry.size})`);
    if (!process.env.MOSAIC_JWT_SECRET && authEnabled) {
      console.log('[mosaic] using ephemeral JWT secret - set MOSAIC_JWT_SECRET for stable sessions');
    }
  }

  return {
    app,
    db,
    jwtSecret,
    authEnabled,
    close: () => db.close(),
  };
}

/** Convenience: app only (caller owns the db lifecycle). */
export async function createMosaicApp(config: MosaicServerConfig): Promise<Hono<AuthEnv>> {
  const server = await createMosaicServer(config);
  return server.app;
}

