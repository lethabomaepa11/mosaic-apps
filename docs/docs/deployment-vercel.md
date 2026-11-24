---
sidebar_position: 12
---

# Deploy to Vercel

A generated Mosaic app deploys as one SvelteKit project. The browser UI and Hono
API share an origin; PostgreSQL is the only separately managed runtime service.

## 1. Provision PostgreSQL

Use Neon, Supabase, or any PostgreSQL-compatible provider. Prefer its pooled
serverless connection string and require TLS. Keep the direct connection string for
operator-run migrations if the provider recommends that split.

From a trusted environment, configure `DATABASE_URL` and run:

```bash
npm run migrate
```

Review destructive statements before applying them. PGlite is for local
development and cannot provide durable Vercel storage.

## 2. Create one Vercel project

Import the generated GitHub repository and configure:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Framework | SvelteKit |
| Build command | `npm run build` |
| Install command | `cd ../.. && npm install` |

Set these environment variables for Preview and Production as appropriate:

```text
DATABASE_URL=postgresql://...
MOSAIC_JWT_SECRET=<stable random value, at least 32 characters>
MOSAIC_DB_POOL_MAX=2
MOSAIC_DB_IDLE_TIMEOUT_MS=30000
MOSAIC_DEPLOY_TARGET=vercel
SEED=false
SEED_DEMO=false
AUTH=on
```

Do not set `PUBLIC_API_URL`: `/api` is handled by the same SvelteKit deployment.
Likewise, same-origin requests do not need CORS configuration.

## 3. Verify

After deployment, check:

```text
GET https://your-app.vercel.app/api/health
GET https://your-app.vercel.app/api/meta
```

Then sign in at `/login`, open a published database route, and exercise a record
read/write path. Confirm the deployment logs contain no seed or migration attempts.

## Uploads and rollback

Vercel's filesystem is ephemeral. Use object storage for production uploads. A
rollback must coordinate the repository deployment, Mosaic artifact revision, and
database migration; reverting only the Vercel build is not sufficient after a
schema change.
