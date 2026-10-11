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
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env.DATABASE_URL ?? '__DB_URL__';
const port = Number(process.env.PORT ?? __API_PORT__);
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);

const server = await createMosaicServer({
  databaseUrl,
  log: true,
  entitiesDir: join(__dirname, 'entities'),
  uploadsDir: process.env.UPLOADS_DIR ?? './uploads',
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
});

serve({ fetch: server.app.fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
  console.log(`[api] docs: open the studio with \`mosaic studio\``);
});

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
