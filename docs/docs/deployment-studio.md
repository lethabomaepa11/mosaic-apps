---
sidebar_position: 13
---

# Studio deployment and upgrade

The current SvelteKit and Next.js scaffolds include visual Studio at `/studio`.
`npm run dev` starts one server for the app, `/api`, and Studio. The Next.js
build compiles the framework Studio as client assets and serves them behind the
app's session. Use an administrator or editor account.

Next.js visual Studio is included in new Cloud releases and scaffolds from the
current source tree. Existing deployments need a new release to pick it up.

## Local authoring

```bash
npm run dev
```

The default topology is:

| Service | URL |
| --- | --- |
| Application and API | `http://localhost:3000` |
| Studio | `http://localhost:3000/studio` |

Change the port with `MOSAIC_WEB_PORT`. Page, form, and
entity definitions are database-first. Source routes, custom components,
dependencies, and entity classes remain repository-owned.

## Upgrade from a separate Studio app

Use this guide if your repository has `apps/studio`, or if scripts still pass
`--studio-port` or set `MOSAIC_STUDIO_PORT`. The unified app serves Studio at
`/studio` and keeps pages, forms, users and entity metadata in your existing
Mosaic database.

### Prepare a staging copy

1. Record the current app and Studio deployment versions, database connection,
   and environment settings. Back up the database and any locally stored uploads.
   For PostgreSQL, restore the backup to a separate staging database. For PGlite,
   stop both apps before copying the `data/` directory to a separate location.
2. Generate a fresh SvelteKit scaffold in a sibling directory. Run the command
   from the parent directory and choose a name that creates a new path.

   ```bash
   npx @mosaic-apps/cli@latest create "Acme Unified" --framework sveltekit --no-demo --no-install
   ```

3. Transfer your app-owned routes, entities, custom components, endpoint
   registrations, styling, and dependencies into the new project. Compare
   changed files with the scaffold and remove example entity definitions your app
   does not use. Keep the same-origin `/api` handler, `/studio` routes, and web
   launch scripts. Port any custom Studio components or registrations from
   `apps/studio` into the unified web app.
4. Point the new project's `.env` at the staging database or copied PGlite
   directory. Preserve `MOSAIC_JWT_SECRET` when testing the same session setup.
   Set `SEED=false` and `SEED_DEMO=false` when reusing an initialized database.
   Replace Studio's separate API URL with same-origin `/api`. Update your local
   scripts to use `MOSAIC_WEB_PORT` for the app and `/studio` together.

### Verify before switching traffic

```bash
npm install
npm run check
npm run build
npx @mosaic-apps/cli migrate --dry-run
npm run dev
```

Inspect the migration plan before applying it. Check `/api/health`, sign in at
`/login`, and open `/studio` with an account that can manage artifacts. Open an
existing published page and form and check a representative record read and
write in staging. Verify custom endpoints and uploads if the old app used them.

### Deploy and keep a rollback path

Deploy the tested `apps/web` build using the [deployment guide](./deployment.md).
Verify the same URLs and a representative write after switching traffic. Retire
the separate Studio deployment once the new `/studio` is verified.

Keep the previous app and Studio deployments available until the cutover is
accepted. If a rollback is needed, switch both routes back and use a database
version compatible with that release. If any schema changes were applied, account
for writes made since the backup before restoring it, then verify the app and
Studio again.

## Hosted preview

Use [Mosaic Cloud](./cloud-studio.md) to build and preview an app, download its
source, and connect GitHub, Vercel and Neon for delivery.
