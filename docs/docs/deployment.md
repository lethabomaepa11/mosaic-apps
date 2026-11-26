---
title: Deployment overview
---

# Deploy a Mosaic application

Deploy one web service for the app, its same-origin `/api`, and visual Studio, backed by durable PostgreSQL. The Next.js build includes Studio's Svelte editor alongside the React app.

| Where you are starting | Follow |
| --- | --- |
| A release in Mosaic Cloud | [Cloud delivery](./cloud-studio.md#deliver-a-release) |
| A repository you manage on Vercel | [Manual Vercel deployment](./deployment-vercel.md) |
| An older project with a separate Studio app | [Studio upgrade](./deployment-studio.md#upgrade-from-a-separate-studio-app) |

For a long-running Node host, build and start the SvelteKit web workspace or the Next.js project root. SvelteKit also has a Netlify adapter selected by `MOSAIC_DEPLOY_TARGET=netlify`. Use a host that runs server code.

## Production configuration

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Durable PostgreSQL connection. Use your provider's pooler for serverless traffic if recommended. |
| `MOSAIC_JWT_SECRET` | Stable random session signing key. Use at least 32 characters and keep it server-side. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Initial administrator for a fresh database. Set these before bootstrap. |
| `SEED`, `SEED_DEMO` | In SvelteKit, `SEED=true` enables bootstrap. Set `SEED_DEMO=false` in production. |
| `MOSAIC_DEPLOY_TARGET` | SvelteKit adapter choice. Set `vercel` or `netlify` on those hosts. |

Keep preview and production database URLs and secrets separate. A manual installation can use compatible PostgreSQL such as Neon or Supabase. Cloud-managed database provisioning uses Neon.

## Release checklist

1. Test the commit against a staging database and back up production.
2. Review the migration plan before applying it. Confirm the command targets the intended database and uses the intended definitions.
3. Deploy the application. Check `/api/health`, sign in with each relevant role, and exercise a real database read and write.
4. Record the commit, published artifact revisions, database migration, and deployment URL.

A filesystem upload directory needs persistent storage. For production uploads on an ephemeral host, implement an object-storage integration. Restoring a previous deployment requires checking database and artifact compatibility as well as code. [Migrations](./migrations.md) · [History](./history.md)
