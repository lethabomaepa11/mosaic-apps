/**
 * __PROJECT_NAME__ API — boots the Mosaic server.
 *
 * Entities are TypeScript classes in `entities/*.entity.ts` (see
 * `entities/customer.entity.ts`); they are synced into the registry at boot.
 * Everything else (tables, CRUD, auth, forms, settings) is automatic.
 */

import { serve } from '@hono/node-server';
import { createMosaicServer } from '@mosaic-apps/server';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const projectDir = resolve(__dirname, '../../..');
let databaseUrl = process.env.DATABASE_URL ?? '__DB_URL__';
if (databaseUrl.startsWith('pglite://') && databaseUrl !== 'pglite://memory') {
  databaseUrl = `pglite://${resolve(projectDir, databaseUrl.slice('pglite://'.length))}`;
}
const port = Number(process.env.PORT ?? __API_PORT__);
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);

const server = await createMosaicServer({
  databaseUrl,
  log: true,
  entitiesDir: join(__dirname, 'entities'),
  uploadsDir: process.env.UPLOADS_DIR ?? join(projectDir, 'uploads'),
  fileStorage: process.env.MOSAIC_FILE_STORAGE === 'database' ? 'database' : 'disk',
  cors: corsOrigins?.length ? { origins: corsOrigins } : true,
  auth: {
    enabled: process.env.AUTH !== 'off',
    allowRegistration: false,
  },
  seed:
    process.env.SEED === 'false'
      ? false
      : {
          admin: {
            email: process.env.ADMIN_EMAIL ?? 'admin@mosaic.local',
            password: process.env.ADMIN_PASSWORD ?? 'admin1234',
            name: 'Administrator',
          },
          demo: process.env.SEED_DEMO !== 'false',
        },
}).catch((error: unknown) => {
  const code = (error as { code?: string }).code;
  if (code === '3D000') {
    console.error('[api] DATABASE_URL points to a PostgreSQL database that does not exist. Create that database first. For the generated Docker database, run npm run db:up.');
  } else if (code === 'ECONNREFUSED') {
    console.error('[api] Cannot connect to PostgreSQL. Start the database service configured in DATABASE_URL (npm run db:up for the generated Docker database).');
  } else {
    console.error('[api] Startup failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  console.error('[api] For embedded local development, set DATABASE_URL=pglite://./data in .env. Existing external data is not moved automatically.');
  process.exit(1);
});

serve({ fetch: async (request) => {
  const response = await server.app.fetch(request);
  if (process.env.MOSAIC_DEV_INSTANCE && new URL(request.url).pathname === '/api/health') {
    response.headers.set('x-mosaic-dev-instance', process.env.MOSAIC_DEV_INSTANCE);
  }
  return response;
}, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
  console.log(`[api] docs: open the studio with \`mosaic studio\``);
});

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
