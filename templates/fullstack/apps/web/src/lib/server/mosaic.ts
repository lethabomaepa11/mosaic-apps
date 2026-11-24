import { createMosaicApiHandlers, createMosaicServerProvider } from '@mosaic-apps/sveltekit';
import { fileURLToPath } from 'node:url';

const env = process.env;
const databaseUrl = env.DATABASE_URL ?? '__DB_URL__';
if (env.VERCEL && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
  throw new Error('Vercel requires a persistent PostgreSQL DATABASE_URL (Neon, Supabase, or compatible PostgreSQL).');
}
if (env.VERCEL && (!env.MOSAIC_JWT_SECRET || env.MOSAIC_JWT_SECRET.length < 32)) {
  throw new Error('Vercel requires a stable MOSAIC_JWT_SECRET of at least 32 characters.');
}

export const mosaicServer = createMosaicServerProvider({
  databaseUrl,
  auth: {
    enabled: env.AUTH !== 'off',
    allowRegistration: false,
    jwtSecret: env.MOSAIC_JWT_SECRET,
  },
  cors: false,
  entitiesDir: env.VERCEL ? undefined : fileURLToPath(new URL('./entities', import.meta.url)),
  seed: env.SEED === 'false' ? false : {
    admin: {
      email: env.ADMIN_EMAIL ?? 'admin@mosaic.local',
      password: env.ADMIN_PASSWORD ?? 'admin1234',
      name: 'Administrator',
    },
    demo: env.SEED_DEMO !== 'false',
  },
  uploadsDir: env.VERCEL ? '/tmp/mosaic-uploads-disabled' : (env.UPLOADS_DIR ?? './uploads'),
});

export const mosaicApi = createMosaicApiHandlers(mosaicServer);
