---
sidebar_position: 13
---

# Deploy a Mosaic application

A generated Mosaic project has three deployable concerns:

1. a PostgreSQL database;
2. the Hono API in `apps/api`;
3. the SvelteKit application in `apps/web`.

Deploy them in that order. The API runs database migrations and owns all secrets. The browser receives only `PUBLIC_API_URL`.

## Production gate

Run this from the project root before a release:

```bash
npm ci
npm run build
npm run migrate -- --dry-run
```

Review destructive migration warnings before applying them. Back up the database before an approved destructive migration.

## 1. Provision PostgreSQL

Mosaic supports PostgreSQL 14 or newer. Copy the provider connection string into the API service as `DATABASE_URL`; never expose it to the web service.

### Neon

Create a project and copy the pooled connection string from **Connect**. A pooled Neon hostname contains `-pooler`, and production strings should retain `sslmode=require`. Neon recommends pooled connections when an application could approach the compute connection limit. See [Neon computes and pooled connections](https://neon.com/docs/manage/endpoints/).

### Supabase

Create a project, open **Connect**, and choose the connection appropriate to the API host. Use a direct connection for a long-running backend with IPv6, or the session pooler for an IPv4 long-running backend. Transaction mode is intended for serverless or edge workloads and has session limitations. See [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres) and [pooling limits](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits).

### Render Postgres

Create Postgres in the same Render region as the API and give the API its internal connection URL. The private URL avoids public-network latency. Use the external URL only from CI or a developer machine that cannot access Render's private network.

### Railway Postgres

Add PostgreSQL to the Railway project, then reference its `DATABASE_URL` from the API service. Railway exposes that variable automatically; see [Railway PostgreSQL](https://docs.railway.com/databases/postgresql).

## 2. Deploy the API

The API should run as a persistent Node service because it uses PostgreSQL transactions and can serve uploaded files from a mounted directory.

Use these commands when the provider builds from the repository root:

| Setting | Value |
|---|---|
| Build | `npm ci && npm --prefix apps/api run build` |
| Pre-deploy/release | `npm run migrate` |
| Start | `npm --prefix apps/api run start` |
| Health check | `/api/health` |

Set these API environment variables:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Secret PostgreSQL connection string |
| `MOSAIC_JWT_SECRET` | At least 32 random bytes; keep stable per environment |
| `CORS_ORIGINS` | Comma-separated web origins, such as `https://app.example.com` |
| `SEED` | `false` after the first controlled initialization |
| `SEED_DEMO` | `false` |
| `AUTH` | `on` |
| `UPLOADS_DIR` | A mounted persistent path, for example `/var/data/uploads` |
| `PORT` | Usually supplied by the host |

For first-time initialization, set `SEED=true`, `SEED_DEMO=false`, `ADMIN_EMAIL`, and a long random `ADMIN_PASSWORD`. Deploy once, verify the administrator login, then set `SEED=false` and remove the two administrator variables.

### Render API

Create a **Web Service**, leave the root directory at the repository root, use the commands above, and set `/api/health` as the health check. Render's pre-deploy command runs migrations after a successful build and before traffic moves to the new release; it is available on paid web services. On other plans, run `npm run migrate` as a controlled one-off job before deployment. See [Render web services](https://render.com/docs/web-services), [deploy commands](https://render.com/docs/deploys), and [monorepo settings](https://render.com/docs/monorepo-support).

Attach a persistent disk and set `UPLOADS_DIR` to its mount path if the application accepts files. Without a disk, uploaded files disappear when the instance is replaced.

### Railway API

Create an API service from the repository and keep the repository root as its build root so npm workspaces resolve. Set the build and start commands from the table, add `npm run migrate` as the pre-deploy command, and reference `DATABASE_URL` from the PostgreSQL service. Railway documents separate service settings for a [monorepo](https://docs.railway.com/deployments/monorepo) and cross-service [variable references](https://docs.railway.com/variables/reference).

### Docker, Fly.io, or another container host

Generated projects include `Dockerfile.api`. Build it from the project root:

```bash
docker build -f Dockerfile.api -t my-mosaic-api .
docker run --rm -p 8787:8787 \
  -e DATABASE_URL \
  -e MOSAIC_JWT_SECRET \
  -e CORS_ORIGINS=https://app.example.com \
  -e SEED=false \
  my-mosaic-api
```

On Fly.io, `fly launch` can use this Dockerfile. Store `DATABASE_URL` and `MOSAIC_JWT_SECRET` with `fly secrets set`, run migrations as a release command, and mount a Fly Volume for `UPLOADS_DIR` when file uploads are enabled. Fly's managed Postgres attachment sets `DATABASE_URL` as a secret; see [Fly apps with Postgres](https://fly.io/web-app-with-postgres/) and [Fly Volumes](https://www.fly.io/docs/flyctl/volumes/).

## 3. Deploy the web app

Set `PUBLIC_API_URL` to the public API base including `/api`, for example:

```text
PUBLIC_API_URL=https://api.example.com/api
```

This is a public build-time value. Do not put database credentials, JWT secrets, or private API keys in any `PUBLIC_` variable. Add the final web origin to the API's `CORS_ORIGINS`.

### Netlify

The generated web app includes the Netlify adapter. In Netlify:

- leave **Base directory** empty so dependencies install at the repository root;
- set **Package directory** to `apps/web`;
- set **Build command** to `npm --prefix apps/web run build`;
- set `MOSAIC_DEPLOY_TARGET=netlify` and `PUBLIC_API_URL=https://your-api.example/api`.

Netlify uses its SvelteKit adapter to emit functions for server-rendered routes. See [SvelteKit on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/sveltekit/) and [Netlify monorepos](https://docs.netlify.com/build/configure-builds/monorepos/).

### Render or Railway web service

Use the default Node adapter:

| Setting | Value |
|---|---|
| Build | `npm ci && npm --prefix apps/web run build` |
| Start | `npm --prefix apps/web run start` |
| Environment | `PUBLIC_API_URL=https://your-api.example/api` |

Deploy the web and API in the same region when possible. They remain separate services and can scale independently.

### Docker

Generated projects also include `Dockerfile.web`. The public API URL must be present at build time:

```bash
docker build -f Dockerfile.web \
  --build-arg PUBLIC_API_URL=https://api.example.com/api \
  -t my-mosaic-web .
docker run --rm -p 3000:3000 -e PORT=3000 my-mosaic-web
```

## Recommended combinations

| Goal | Database | API | Web |
|---|---|---|---|
| Simple managed stack | Render Postgres | Render Web Service | Render Web Service |
| Fast frontend workflow | Neon or Supabase | Render or Railway | Netlify |
| One project dashboard | Railway Postgres | Railway | Railway |
| Region control and containers | Fly Managed Postgres, Neon, or Supabase | Fly.io | Fly.io or Netlify |

Choose a database and API region close to each other. Database latency affects every CRUD request more than the distance between the browser and the frontend CDN.

## Release and rollback checklist

- `GET /api/health` returns HTTP 200 and reports a live database.
- `CORS_ORIGINS` contains only the deployed web origins.
- `SEED=false`, `SEED_DEMO=false`, and the default administrator password is gone.
- `MOSAIC_JWT_SECRET` is secret, stable, and different between staging and production.
- Uploads use a persistent disk and that disk has a backup policy.
- Database backups and restore procedures have been exercised.
- Migrations finish before the new API receives traffic.
- The previous API and web image remain available for rollback.
- A smoke test covers login, one list view, one create/update flow, a published form, and an uploaded asset.
