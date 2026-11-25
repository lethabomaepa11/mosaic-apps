---
sidebar_position: 11
---

# Deployment

Mosaic's generated runtime has two durable parts:

1. one SvelteKit application serving UI and the Hono `/api` routes;
2. one PostgreSQL database for artifacts, users, metadata, and business tables.

Studio is built into the same application at `/studio` (sign-in required), so there is
no separate Studio deployment. Visual
publishes update PostgreSQL without rebuilding; Svelte, dependency, adapter, and
schema-source changes go through Git and a normal application deployment.

## Required configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon, Supabase, or compatible PostgreSQL connection |
| `MOSAIC_JWT_SECRET` | Stable signing key, at least 32 characters in production |
| `AUTH` | `on` unless the application is intentionally public |
| `SEED` | `false` after controlled bootstrap |
| `SEED_DEMO` | `false` in production |
| `MOSAIC_DEPLOY_TARGET` | `vercel`, `netlify`, or omitted for Node |

`PUBLIC_API_URL` is unnecessary for the unified app because the API is same-origin.
Never expose database credentials or the signing key through `PUBLIC_*` variables.

## Release sequence

1. Build and test the exact commit.
2. Back up production data and artifact revisions.
3. Run `npm run migrate` with the production database URL and review its plan.
4. Deploy `apps/web`.
5. Verify `/api/health`, login, a database page, and a write path.
6. Record the commit, artifact revisions, migration, and deployment URL as one
   release unit.

For a long-running Node host, build `apps/web` and run its generated Node adapter
output. For Vercel, follow the dedicated Vercel guide. For Netlify, set
`MOSAIC_DEPLOY_TARGET=netlify`. In all cases the host must support server-side Node
code; a static-only export cannot run Mosaic's API.

## Database providers

- Neon: use a pooled URL for serverless requests; use branches for preview data.
- Supabase: use its Postgres connection or pooler; Supabase Auth is optional and is
  not automatically substituted for Mosaic auth.
- Generic PostgreSQL: use TLS, backups, a restricted application role, and a
  separate migration/operator role when possible.

## Files and observability

Local disk uploads require persistent Node storage. Serverless deployments should
use an object-storage adapter. Keep request, job, deployment, and release IDs in
logs; redact connection strings, tokens, form secrets, and record payloads.
