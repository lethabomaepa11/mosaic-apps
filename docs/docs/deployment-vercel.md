---
sidebar_position: 15
---

# Deploy web, API and Studio on Vercel with Neon

Use one Neon database and three Vercel projects from the same generated Mosaic
repository. The API runs as a Hono Node function; web and Studio use SvelteKit's
Vercel adapter. These steps require a project generated with CLI 0.2.1 or newer.

| Project | Root directory | Purpose |
| --- | --- | --- |
| API | `apps/api` | Authentication, metadata and CRUD connected to Neon |
| Web | `apps/web` | Published application forms and pages |
| Studio | `apps/studio` | Design, configure and publish the application |

Vercel supports native Hono applications that export a Hono instance. Mosaic
provides that entry at `apps/api/app.ts`; it does not open a listening port.
See [Hono on Vercel](https://vercel.com/docs/frameworks/backend/hono).

## 1. Prepare your application repository

Create a project, then commit it to your Git provider:

```bash
npx @mosaic-apps/cli@latest create my-crm
cd my-crm
```

Commit source files and `package-lock.json`. Keep `.env`, `.env.production`,
local `data/` and uploads out of Git. Verify `npm run build` locally. Do not
use local `file:` dependencies when deploying to Vercel.

## 2. Create your Neon database

1. Create a Neon project and choose a region near your Vercel functions.
2. Open **Connect** and choose your database and role.
3. Enable connection pooling and copy the PostgreSQL connection string.
4. Keep its TLS options, including `sslmode=require` when supplied.
5. Store the string privately; only the API needs it.

Mosaic uses the `pg` driver in a Node runtime. It does not require a different
database driver to connect to Neon. Neon pooling reduces pressure on database
connections as functions scale; see [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).

## 3. Initialize the database before deploying

Create a private `.env.production` in your project root:

```dotenv
DATABASE_URL=<your-Neon-pooled-PostgreSQL-URL>
MOSAIC_JWT_SECRET=<a-stable-random-secret>
ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD=<a-long-random-password>
```

Generate the JWT secret with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Run the CLI against that configuration:

```bash
node --env-file=.env.production node_modules/@mosaic-apps/cli/dist/index.js migrate --dry-run
node --env-file=.env.production node_modules/@mosaic-apps/cli/dist/index.js migrate
node --env-file=.env.production node_modules/@mosaic-apps/cli/dist/index.js seed
```

Review the SQL preview before applying it. The seed command creates the configured
administrator without demo data unless `--demo` is supplied. Keep your normal
local `.env` separate. The serverless entry reads entity metadata from PostgreSQL,
so migrate again before deploying changes to entity source files. It does not
seed accounts or scan a mutable entity directory on each function startup.

## 4. Deploy the Hono API

1. In Vercel, select **Add New → Project** and import your repository.
2. Set **Root Directory** to `apps/api`.
3. Enable **Include source files outside of the Root Directory in the Build Step**
   so npm workspaces and the root lockfile are available.
4. Choose the **Hono** framework preset and a supported Node version, such as 22.x.
5. Use the supplied `apps/api/vercel.json`. It sets the install command to
   `cd ../.. && npm ci` and the build command to
   `cd ../.. && npm run build -w apps/api`.
6. Add the environment variables below and deploy.

```dotenv
DATABASE_URL=<your-Neon-pooled-PostgreSQL-URL>
MOSAIC_JWT_SECRET=<the-same-stable-secret>
CORS_ORIGINS=https://my-crm-web.vercel.app,https://my-crm-studio.vercel.app
```

Replace the sample frontend origins after creating those projects. Set variables
for the intended Vercel environments; preview deployments should use a separate
database or Neon branch. Do not add these secrets to frontend projects.

Open `https://<your-api-domain>/api/health` and check `ok: true` and `db: true`.
Do not use the local `src/index.ts` development launcher as a serverless handler.
The native Hono entry reuses initialized server state across requests in a warm
instance. Authentication stays enabled.

## 5. Deploy the web application

Import the same repository as a second Vercel project:

| Setting | Value |
| --- | --- |
| Framework preset | SvelteKit |
| Root directory | `apps/web` |
| Include source outside root | Enabled |
| Install command | `cd ../.. && npm ci` |
| Build command | `npm run build` |
| Output directory | Leave the framework default |

Add these build environment variables:

```dotenv
MOSAIC_DEPLOY_TARGET=vercel
PUBLIC_API_URL=https://<your-api-domain>/api
MOSAIC_APP_ORIGIN=https://<your-web-domain>
```

Deploy. The generated Vite configuration selects the Vercel adapter. Keep `/api`
at the end of the public API URL. See [SvelteKit's Vercel adapter](https://svelte.dev/docs/kit/adapter-vercel).

## 6. Deploy Studio

Create a third Vercel project with the same settings as the web project, but use
**Root Directory** `apps/studio`. Set:

```dotenv
MOSAIC_DEPLOY_TARGET=vercel
PUBLIC_API_URL=https://<your-api-domain>/api
MOSAIC_APP_ORIGIN=https://<your-studio-domain>
```

Deploy, then open Studio's `/login`. Sign in with the account created in step 3.
Both frontends use the same API and database; Studio does not need its own
database or signing secret. `PUBLIC_API_URL` is a build-time value, so rebuild
if the API domain changes.

Vercel treats the three directories as separate projects. The outside-root
setting is described in [Vercel's monorepo FAQ](https://vercel.com/docs/monorepos/monorepo-faq).

## 7. Set final domains and verify

1. Add custom domains if desired.
2. Update each frontend's `MOSAIC_APP_ORIGIN` and rebuild it.
3. Update API `CORS_ORIGINS` to include the exact web and Studio origins, with
   no paths or trailing slashes, then redeploy the API.
4. In Studio, create a form and click **Save** to publish it.
5. Open `/f/<slug>` on the deployed web application and submit a test record.
6. Verify the record through Studio and check JSON/script Monaco modals load.
7. Keep the JWT secret stable, configure database backups, and use a separate
   database for staging and previews.

## Uploaded files and other hosts

The current built-in file service stores uploads on local disk. Vercel function
storage is not durable, so the serverless entry rejects `/api/files` and `/files`
routes instead of accepting files that could disappear. A Vercel Blob, S3 or
other object-storage adapter is not implemented yet.

If your application needs built-in logo, image or file uploads, deploy the API
on Render, Railway, Fly.io or another Node host with a persistent volume. Web
and Studio can still remain on Vercel and connect to that API. Follow the
[Studio and persistent-service guide](./deployment-studio.md).

The current API uses Node PostgreSQL and filesystem packages; deploying Hono
alone to an edge runtime does not make this entire backend edge-compatible.
