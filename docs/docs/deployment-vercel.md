---
title: Deploy to Vercel
---

# Deploy to Vercel

Use this guide for a repository you manage. For a release in Mosaic Cloud, follow [Cloud delivery](./cloud-studio.md#deliver-a-release).

## 1. Provision PostgreSQL

Create a durable PostgreSQL database with a provider such as Neon or Supabase. Prefer the provider's pooled connection for serverless traffic. If the provider recommends a direct connection for migrations, keep it available for operator-run schema updates. Use separate databases or branches for preview and production.

## 2. Import the repository

| Vercel setting | SvelteKit | Next.js |
| --- | --- | --- |
| Root directory | `apps/web` | Repository root |
| Framework preset | SvelteKit | Next.js |
| Install command | `npm install` | `npm ci` with the provided lockfile |
| Build command | `npm run build` | `npm run build` |

Allow access to files outside the SvelteKit root when building the generated workspace. Configure `DATABASE_URL`, `MOSAIC_JWT_SECRET` and initial `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the environment. Add `MOSAIC_DEPLOY_TARGET=vercel` for SvelteKit. For a fresh SvelteKit database, enable `SEED=true` during bootstrap and set `SEED_DEMO=false`. A Cloud-generated Next.js app uses the administrator credentials during first-start artifact import.

## 3. Verify the deployment

Check `/api/health` for a working database connection. Sign in at `/login` and test a published route, a database write and a restricted action as a regular user. Open `/studio` with an administrator account and check the deployed artifacts.

## Common failures

| Symptom | Check |
| --- | --- |
| Root directory does not exist | Use the actual framework root in the repository you imported. SvelteKit projects with `apps/web` and root-level Next.js projects use different settings. |
| Dependency install fails | Open the install log for the first npm error. Verify the lockfile and package versions for that source tree. |
| Health reports a database failure | Check the environment's PostgreSQL URL, TLS, and database access. PGlite is for local development. |
| Missing initial pages or credentials | Check bootstrap settings and the administrator configuration. For Cloud, reveal the credentials in **Source & delivery**. |

Vercel's filesystem is ephemeral. Plan for persistent uploads and review database compatibility before restoring an older release. [Deployment checklist](./deployment.md)
