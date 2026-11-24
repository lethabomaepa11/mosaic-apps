# Mosaic Cloud

Mosaic Cloud is the hosted control plane for creating and operating Mosaic apps.
This first vertical slice provides self-serve account creation, sign-in, organizations, projects, default page
choices, framework/UI-system/theme preferences, conversations, environments, durable jobs, provider-connection records,
and an audit log.

Project creation uses Groq structured output to turn the brief into a typed
application blueprint (routes, physical business entities, roles, and workflows)
before the generation job is queued. `GROQ_API_KEY` stays server-side; local
development uses a deterministic fallback when it is absent.

The Cloud shell stays on a consistent Corporate theme. Each project brief exposes
the curated DaisyUI themes Corporate, Business, Light, Dark, Nord, Winter, Silk,
and Lo-fi. The project theme is stored in PostgreSQL so the generator can apply the
same design tokens to the whole generated app.

It intentionally does not pretend that a queued job is already a generated app.
The isolated workspace worker, code-generation operations, GitHub App, Vercel OAuth, database
provisioning, encrypted secret operations, usage, and billing are subsequent
milestones tracked in `contributor-docs/platform-plan.md`.

## Local development

From the repository root:

```bash
npm install
npm run dev -w @mosaic-apps/cloud
```

Open `http://127.0.0.1:3010`. With no environment file, local development uses
PGlite in `apps/cloud/data/cloud` and creates `admin@mosaic.local` / `admin1234`.
Copy `.env.example` to `.env` to use durable PostgreSQL and explicit credentials.

## Verification

```bash
npm run check -w @mosaic-apps/cloud
npm run build -w @mosaic-apps/cloud
```

`GET /api/health` reports the service and database driver without disclosing the
connection string.

## Vercel

Create a separate Vercel project rooted at `apps/cloud`, set the install command to
`cd ../.. && npm install`, and keep the build command as `npm run build`. Configure
all values in `.env.example`; PGlite is deliberately rejected on Vercel because a
serverless filesystem is not durable. The SvelteKit Vercel adapter produces the
Build Output API bundle in `apps/cloud/.vercel/output`.

The initial admin variables are only used if no matching user exists. Rotate or
remove the bootstrap password after the first production sign-in. Never commit a
real provider credential or database URL.
