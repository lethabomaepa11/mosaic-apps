---
title: Local quickstart
---

# Create your first application

Use Node.js 22.17 or newer and npm 11 or newer. The CLI uses persistent embedded PostgreSQL for local development by default. For hosted generation, use [Mosaic Cloud](./cloud-studio.md).

## Create and start the app

```bash
npx @mosaic-apps/cli@latest create my-crm
cd my-crm
npm run dev
```

This creates a SvelteKit app. Add `--framework nextjs` to create a Next.js app. Both expose the same-origin API at `/api`. The CLI writes `.env` with a database URL and a session secret and installs dependencies unless you pass `--no-install`.

| | SvelteKit | Next.js |
| --- | --- | --- |
| App | `http://localhost:3000` | `http://localhost:3000` |
| Health | `/api/health` | `/api/health` |
| Studio | Visual pages and forms at `/studio` | Page JSON at `/studio` |
| Local admin | `admin@mosaic.local` / `admin1234` with `SEED=true`, unless you configured credentials | Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` to seed your admin |

These are local setup instructions. Cloud-created deployments provide generated credentials in [Source & delivery](./cloud-studio.md#deliver-a-release).

## Create an entity and form

This example uses the SvelteKit Studio.

1. Stop the development server before using the CLI against its embedded database. Scaffold a product entity and inspect its migration.

   ```bash
   npx @mosaic-apps/cli entity Product --fields "name:string,price:decimal,active:boolean"
   npx @mosaic-apps/cli migrate --dry-run
   npx @mosaic-apps/cli migrate
   ```

2. Restart the app so it loads the new entity source. Open `/studio` and sign in.
3. Open **Forms**, create a form named **Product**, and choose the **Product** entity in **Form settings**.
4. Add a text field bound to `name` and a number or currency field bound to `price`. Match bindings to the entity's field names.
5. Choose **Save** to publish and **Preview** to try the form. Open its published route at `/f/<slug>` to test a record write.

The SvelteKit entity file lives in `apps/web/src/lib/server/entities/`. Published pages use their configured routes directly. You can also register your own concrete app routes.

## Resolve startup conflicts

Set a free port at creation with `--web-port` or change the SvelteKit launcher port with `MOSAIC_WEB_PORT` in `.env`. In a generated Next.js project, change the port in the `dev` script.

Embedded PostgreSQL starts with the app and stores SvelteKit project data under `data/` by default. If you supplied an external `DATABASE_URL`, start that database and confirm the host, port, and database name. The generated SvelteKit Docker service can be started with `npm run db:up`.

Continue with the [Studio guide](./builder.md), [CLI reference](./cli.md), or [deployment guide](./deployment.md).
