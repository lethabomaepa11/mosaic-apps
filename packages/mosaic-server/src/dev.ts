/** Local development server: `npm run dev -w @mosaic/server`. */

import { serve } from '@hono/node-server';
import { createMosaicServer } from './app.js';

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

async function main(): Promise<void> {
  // default: embedded Postgres (WASM) — no external DB needed for quickstart.
  // set DATABASE_URL=postgres://... to use a real server instead.
  const databaseUrl = env('DATABASE_URL', 'pglite://memory');
  const port = Number(env('PORT', '8787'));

  const server = await createMosaicServer({
    databaseUrl,
    log: true,
    seed: process.env.SEED === 'false' ? false : { admin: { email: 'admin@mosaic.local', password: 'admin1234' }, demo: true },
    auth: {
      enabled: process.env.AUTH === 'off' ? false : true,
      allowRegistration: false,
    },
    entitiesDir: process.env.ENTITIES_DIR,
    uploadsDir: env('UPLOADS_DIR', './uploads'),
  });

  serve({ fetch: server.app.fetch, port }, (info) => {
    console.log(`[mosaic] dev API listening on http://localhost:${info.port}`);
  });

  const shutdown = async () => {
    console.log('\n[mosaic] shutting down...');
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[mosaic] failed to start:', err);
  process.exit(1);
});
