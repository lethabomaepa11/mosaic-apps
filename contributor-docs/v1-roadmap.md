# Road to Mosaic v1

What has to be true before we call Mosaic (framework, Studio, Cloud) v1, written after
the November 2026 Cloud build-out. Each item says what "done" means. **P0** blocks v1,
**P1** is expected for v1, **P2** can follow.

Track implementation, acceptance criteria, and verification in the
[v1 GitHub issues](https://github.com/lethabomaepa11/mosaic-apps/issues?q=label%3Av1).

## Where we are (verified)

- One prompt → clarifying questions (asked once) → developer/verifier/reviewer agents →
  a verified Mosaic app with real CRUD, relations, dashboards and sample data, running live
  in the Cloud preview with zero full-page reloads.
- Releases are the full `mosaic create` project: one SvelteKit app, API at `/api`, Studio
  at `/studio`, generated entities plus a first-boot importer for forms/pages.
- Delivery code for GitHub/Neon/Vercel, OAuth for GitHub and Vercel, GitHub sign-in,
  public prompt page, bring-your-own AI key (OpenAI, Claude, DeepSeek).
- Tests: Cloud 21, server 33, core 32, UI 14+; full-repo typecheck clean.

**Not yet verified against real accounts:** GitHub repository creation and commits,
Neon provisioning, Vercel project creation, monorepo deploy (`apps/web` root), the
post-deploy API publish, and both OAuth flows. All are covered only by tests with faked
provider responses. This is the first thing to close.

## 1. Delivery and environments

- **P0 Live provider verification.** One real end-to-end run per path: none, GitHub only,
  Neon only, Vercel+Neon, all three, including a follow-up change. Record evidence
  (repo URL, deployment URL, health check) in `platform-plan.md`.
- **P0 Deployment logs and failures in the builder.** Stream Vercel build logs into the
  chat; when a build fails, show the reason and let the developer agent attempt a fix.
- **P0 Safe schema changes on live apps.** Today live updates apply migrations with
  `allowDestructive: false` and silently skip destructive changes. Show a migration review
  (what would be dropped or narrowed, and row counts) and require explicit approval.
- **P1 Rollback.** One action that restores a release, the matching artifact revisions,
  and a compatible schema (docs/deployment-vercel.md: rolling back Vercel alone is wrong
  after a schema change).
- **P1 Preview vs production.** Separate Vercel preview/production targets and Neon
  branches per environment; promote a release explicitly.
- **P1 GitHub App** instead of an OAuth App for least-privilege, per-repository access;
  import an existing Mosaic repository into Cloud.
- **P1 Vercel team picker and custom domains**; **P2** Supabase / generic PostgreSQL.

## 2. Generation quality (agents)

- **P0 Evaluation suite.** 20-30 golden prompts (CRM, bookings, inventory, HR, events,
  ...) run nightly against each supported model; track pass rate (verified and reviewer
  approved), rounds, tokens, wall time. v1 bar: ≥90% first-build success on the default
  model and ≥97% with a frontier model.
- **P0 Richer pages.** The compiler emits headings, text, stat cards and CRUD tables.
  Add record detail pages, form layouts with sections, filters and saved views, charts,
  calendars for date entities, kanban for status enums, and role-aware navigation.
- **P0 Workflows.** Status transitions with guards (approve/reject), confirmations,
  record actions, and notifications, expressed as Mosaic actions, not free code.
- **P1 Custom code.** Let the developer agent add Svelte components and server endpoints
  (registered through the extension contract), verified by a real install/check/build in
  an isolated workspace (not the Cloud process), then committed and deployed.
- **P1 Targeted edits.** Change requests patch the spec instead of regenerating it whole;
  show a diff of what changed (entities, fields, pages) before applying destructive ones.
- **P1 Cost and speed.** Prompt caching where providers support it, smaller prompts per
  agent, token/cost accounting per build, and model routing (cheap model for repairs,
  strong model for design and review).
- **P2** Visual review: render the preview and let the reviewer judge screenshots.

## 3. Preview and Studio in Cloud

- **P0 Durable, isolated previews.** On serverless the preview database is in-memory per
  instance, so data entered in the preview can vanish or differ between requests. Use a
  per-project Neon branch or schema in a dedicated preview database.
- **P0 Separate origin for previews.** Previews run on the Cloud origin with the user's
  session. Before generated apps can include custom code, serve previews from an isolated
  origin (for example `*.preview.<domain>`) with their own session.
- **P1 Studio for hosted projects.** Open the project's Studio (`/studio`) against the
  preview from the builder, so visual edits and chat edits work on the same artifacts.
- **P1 Theme fidelity.** Map the project theme to the app's `mosaic_settings` theme
  record so preview, download and deployment look identical.

## 4. Cloud platform

- **P0 Account basics.** Email verification, password reset, rate limiting on sign-in,
  sign-up and the public prompt endpoint, and bot protection.
- **P0 Usage limits and billing.** Per-workspace quotas for builds and AI tokens on the
  default model (the free Groq tier is shared: about 8k tokens/min, 1k requests/day), plans,
  and Stripe billing; clear messaging when a limit is hit.
- **P0 Reliable workers.** Builds can outlast a single `waitUntil` window (240s budget).
  Move to a durable queue consumer (cron-triggered or dedicated worker) with leases,
  heartbeats and per-workspace concurrency limits.
- **P1 Teams.** Invites, roles (owner/admin/editor/viewer) enforced across projects,
  connections and AI settings; audit log UI.
- **P1 Observability.** Error tracking, job metrics (duration, failures by stage,
  rate-limit waits), alerts.
- **P1 Data lifecycle.** Delete project/workspace/account (including provider resources
  on request), retention policy, data export.

## 5. Framework (core, server, ui)

- **P0 Page access enforcement.** Published pages with `requiresAuth` now require a
  session through both the framework API and the SvelteKit loader. Anonymous routing
  receives only route paths for protected pages so it can redirect to sign-in.
  Role-based page access still needs a policy and enforcement.
- **Multi-instance registry consistency.** CRUD reads the current definition and
  requested reference definitions from the database. CI checks creation, schema
  and permission changes, and entity removal through two independent PostgreSQL
  server instances. Track evidence in [#27](https://github.com/lethabomaepa11/mosaic-apps/issues/27).
- **P0 Session revocation and password hashing.** Revoke tokens on password change
  and move password hashing off the event loop.
- **P0 Uploads to object storage** (Vercel's filesystem is ephemeral); signed URLs.
- **P1** Data-source loading for every form/page source type, nested form validation in
  parent submits, draft conflict resolution, opt-in state persistence (from the docs
  roadmap). `NumberField` should show a range error instead of saving `null`.
- **P1 Studio hardening** (now inside the app at `/studio`): stop storing the JWT in
  `localStorage` (use the HttpOnly cookie), await logout, gate on permissions
  (`forms:manage`/`pages:manage`) not only role names, make Studio usable with `AUTH=off`.
- **P1 UI polish** carried over: generic DataTable truncation review, dark-mode pass on
  pinned columns, menu trigger styling, accessibility audit (WCAG 2.2 AA) of every
  registry component.

## 6. Release and docs

- **P0 Publishing.** CI publishes `@mosaic-apps/*` to npm on tagged releases with
  provenance; a consumer project created from the published packages passes check,
  build and a browser smoke test before the tag is promoted.
- **P0 Upgrade notes.** Projects created before Studio moved into the app (no more
  `apps/studio`, `--studio-port` removed) need a migration guide.
- **P0 Template linking.** `mosaic create --link` now places the linked UI package's
  dependencies in the generated app manifest. A fresh linked app passed `npm install`,
  `npm run check`, and the Node production build on Windows.
- **P1 Docs site.** Quickstart video/GIFs, Cloud guide with screenshots, provider setup
  guides (GitHub OAuth App, Vercel Integration, Neon key), troubleshooting, changelog.

## v1 exit criteria

1. Every P0 above is done and has recorded evidence.
2. The golden-prompt suite meets its pass rates for two consecutive weeks.
3. All delivery paths pass live end-to-end runs, including rollback.
4. Security review (auth, preview isolation, secret handling, SSRF on provider calls)
   with no open high-severity findings.
5. Accessibility audit passes for Cloud, Studio and generated apps.
6. A user who has never seen Mosaic can go from prompt to a deployed app on their own
   accounts in under 15 minutes without help.
