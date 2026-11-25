import { createMosaicServer } from '@mosaic-apps/server';

let initialization;

export function mosaicServer() {
  return initialization ??= start().catch((cause) => {
    initialization = undefined;
    throw cause;
  });
}

async function start() {
  const { DATABASE_URL, MOSAIC_JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, NODE_ENV, VERCEL } = process.env;
  if (NODE_ENV === 'production' && (!DATABASE_URL || !MOSAIC_JWT_SECRET || MOSAIC_JWT_SECRET.length < 32)) {
    throw new Error('Set DATABASE_URL and a MOSAIC_JWT_SECRET of at least 32 characters.');
  }
  if (VERCEL && !/^postgres(?:ql)?:\/\//.test(DATABASE_URL ?? '')) {
    throw new Error('Vercel requires a persistent PostgreSQL DATABASE_URL.');
  }
  if (Boolean(ADMIN_EMAIL) !== Boolean(ADMIN_PASSWORD)) {
    throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD to seed an administrator.');
  }
  return createMosaicServer({
    databaseUrl: DATABASE_URL ?? 'pglite://./.mosaic-data',
    auth: { jwtSecret: MOSAIC_JWT_SECRET },
    cors: false,
    seed: ADMIN_EMAIL && ADMIN_PASSWORD ? { admin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, demo: false } : false,
  });
}
