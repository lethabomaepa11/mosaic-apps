---
sidebar_position: 12
---

# Deploy to Vercel

A generated Mosaic app deploys as one SvelteKit or Next.js project with its Hono
API on the same origin. In [Mosaic Cloud](./cloud-studio.md), connect GitHub,
Neon and Vercel to automate these steps. The steps below describe manual delivery.

## 1. Provision PostgreSQL

Use Neon, Supabase, or any PostgreSQL-compatible provider. Prefer its pooled
serverless connection string and require TLS. Keep the direct connection string for
operator-run migrations if the provider recommends that split.

From a trusted environment, configure `DATABASE_URL` and preview entity migrations.

```bash
npx @mosaic-apps/cli migrate --dry-run
```

Review destructive statements before applying them. PGlite is for local
development and cannot provide durable Vercel storage.

## 2. Create one Vercel project

Import the generated GitHub repository and configure:

| Setting | SvelteKit | Next.js |
| --- | --- | --- |
| Root Directory | `apps/web` | Repository root |
| Framework | SvelteKit | Next.js |
| Build command | `npm run build` | `npm run build` |
| Install command | `npm install` | `npm ci` |

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

The Mosaic API is available as `/api` on the deployed app's origin.
Set `MOSAIC_DEPLOY_TARGET=vercel` for SvelteKit's Vercel adapter. For a generated
Next.js app, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to initialize its entities,
pages and forms. Cloud generates and stores these credentials for managed delivery.

## 3. Verify

After deployment, check:

```text
GET https://your-app.vercel.app/api/health
GET https://your-app.vercel.app/api/meta
```

Then sign in at `/login`, open a published database route, and exercise a record
read/write path. Cloud verifies the Next.js API's database connection and publishes
the release's artifacts before reporting production ready.

## Uploads and rollback

Vercel's filesystem is ephemeral. Use object storage for production uploads. A
rollback must coordinate the repository deployment, Mosaic artifact revision, and
database migration; reverting only the Vercel build is not sufficient after a
schema change.
