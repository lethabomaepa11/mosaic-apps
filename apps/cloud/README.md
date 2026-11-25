# Mosaic Cloud

Mosaic Cloud turns one prompt into a working Mosaic app, shows it live while it builds,
and delivers it to the user's own GitHub, Neon and Vercel accounts.

## How a build works

1. **Prompt.** Anyone can type a prompt on `/`. Signed-out visitors keep their prompt
   (HttpOnly cookie) through sign-up, sign-in or "Continue with GitHub", and the project
   starts as soon as they are in.
2. **Durable job.** Creating a project or sending a chat message only queues a job in
   `cloud_jobs` and returns. The runner (`src/lib/server/jobs.ts`) works after the
   response via `waitUntil`; reopening the builder resumes stalled jobs, and failed jobs
   can be retried. Nothing reloads the page; the builder polls job state.
3. **Agents** (`src/lib/server/agents.ts`, `build-app.ts`), all primed with a condensed
   Mosaic knowledge pack (`mosaic-knowledge.ts`, from `docs/` and the template skill):
   - **Planner** asks at most one round of clarifying questions, only when the answer
     would change the data model. Any reply (or "Decide for me") resumes the same job.
   - **Developer** writes an *app spec* (entities, fields, relations, pages, roles,
     sample data) and fixes it against problems.
   - **Verifier** auto-repairs mechanical mistakes, validates the spec, compiles it to
     real Mosaic entities/forms/pages (`spec.ts`), boots a throwaway Mosaic server and
     runs create/list/read/update on every entity with relations (`mosaic-runtime.ts`).
   - **Reviewer** judges MVP completeness against the brief; its issues go back to the
     developer, and every change is re-verified. A broken app is never shipped.
   Each step's thinking streams into the chat, labelled by agent.
4. **Live preview.** The verified app is published to a real Mosaic server inside Cloud
   with its own database (`preview.ts`; local PGlite under `data/previews`, in-memory on
   serverless). `/preview/<slug>` renders its published pages with `PageRenderer`
   through a member-only same-origin API proxy; the preview admin token never reaches
   the browser.
5. **Release.** Each build stores a versioned release: the full `mosaic create` project
   (`templates/fullstack`, bundled at build time by `template.ts`): one SvelteKit app
   with the API at `/api` and Studio at `/studio`, the generated entities as entity JSON,
   and an importer that publishes the generated forms/pages on the app's first boot.
   Download it as `.tar.gz` or let delivery push it.
6. **Delivery** to the *user's own* accounts (`delivery.ts`): Neon provisions the
   database, GitHub gets a private repo and one commit per release, Vercel gets a project
   (root `apps/web`) with per-project secrets, deploys, is polled until ready, and then
   Cloud publishes the latest pages and data model through the live app's API.

## AI models

The default is Groq `openai/gpt-oss-120b` with the operator's `GROQ_API_KEY`. On the free
tier that is about 8,000 tokens per minute and 1,000 requests per day shared by every
user, so a build takes roughly 3 to 6 minutes and may wait on the rate limit (the chat says
so). Users can bring their own key in **Settings → AI**: ChatGPT (OpenAI API), Claude
(Anthropic API, official SDK, default `claude-opus-5-5` with server-side refusal
fallback) or DeepSeek. Keys are validated, AES-GCM encrypted and only used for that
user's builds. ChatGPT Plus and Claude Pro subscriptions do not include API access.

## Connections

Users connect GitHub and Vercel with OAuth (when the OAuth App / Integration are
configured) or by pasting a token; Neon uses an API key (Neon OAuth is partner-only).
GitHub sign-in to Cloud reuses the GitHub OAuth App. Register `/auth/github/callback`
and `/settings/connections/github/callback` as exact URLs on the Cloud domain.
Disable expiring user access tokens until Cloud supports refreshing them.

## Local development

From the repository root:

```bash
npm install
npm run dev -w @mosaic-apps/cloud
```

Open `http://127.0.0.1:3010`. With no environment file, local development uses PGlite in
`apps/cloud/data/cloud` and creates `admin@mosaic.local` / `admin1234`. Put local secrets
(at least `GROQ_API_KEY`) in `apps/cloud/.env`; it is gitignored and loaded in dev only.

## Verification

```bash
npm test -w @mosaic-apps/cloud
npm run check -w @mosaic-apps/cloud
npm run build -w @mosaic-apps/cloud
```

`GET /api/health` reports the service and database driver without disclosing the
connection string.

## Vercel

Create a Vercel project rooted at `apps/cloud` with access to files outside that directory.
Set the install command to `cd ../.. && npm ci` and the build command to
`cd ../.. && npm run build -w @mosaic-apps/core && npm run build -w @mosaic-apps/server && npm run build -w @mosaic-apps/cloud`. Configure the
values in `.env.example`. Built servers refuse local defaults: they need
`CLOUD_DATABASE_URL` (PostgreSQL), `CLOUD_SESSION_SECRET`, `CLOUD_PROVIDER_SECRET_KEY`
and `GROQ_API_KEY`. Never change `CLOUD_PROVIDER_SECRET_KEY` once set (stored
credentials would no longer decrypt). Never commit a real credential or database URL.
