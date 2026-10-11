/** Request handler shared by the native Vercel Hono entry point. */
import { createMosaicServer, type MosaicServer } from '@mosaic-apps/server';

let initialization: Promise<MosaicServer> | undefined;

function initialize(): Promise<MosaicServer> {
  if (initialization) return initialization;
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.MOSAIC_JWT_SECRET;
  if (!databaseUrl || (process.env.VERCEL && !/^postgres(ql)?:\/\//.test(databaseUrl))) {
    throw new Error('Set DATABASE_URL to a persistent PostgreSQL connection string. Embedded databases are not supported on Vercel.');
  }
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('Set a stable MOSAIC_JWT_SECRET of at least 32 characters.');
  const origins = process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
  initialization = createMosaicServer({
    databaseUrl,
    auth: { enabled: true, allowRegistration: false, jwtSecret },
    cors: origins.length ? { origins } : false,
    seed: false,
    // Entity metadata is migrated into PostgreSQL before deployment. Never
    // depend on the function bundle containing a mutable entities directory.
    uploadsDir: '/tmp/mosaic-uploads-disabled',
  }).catch((error) => { initialization = undefined; throw error; });
  return initialization;
}

export async function mosaicFetch(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (/^\/(api\/files|files)(\/|$)/.test(pathname)) {
    return Response.json({ success: false, error: {
      code: 'PERSISTENT_UPLOAD_STORAGE_REQUIRED',
      message: 'File uploads require a persistent API host. Local upload storage is disabled on serverless deployments.',
    } }, { status: 501 });
  }
  try {
    return await (await initialize()).app.fetch(request);
  } catch (error) {
    // Keep provider credentials and SQL details out of HTTP responses.
    console.error('[mosaic] serverless API initialization failed:', (error as { code?: string }).code ?? 'CONFIGURATION_OR_DATABASE');
    return Response.json({ success: false, error: { code: 'API_UNAVAILABLE', message: 'API initialization failed. Check the deployment configuration and database.' } }, { status: 503 });
  }
}

/** Graceful shutdown for local verification or a Node host reusing this handler. */
export async function closeServerlessMosaicServer(): Promise<void> {
  const pending = initialization;
  initialization = undefined;
  if (pending) await (await pending).close();
}
