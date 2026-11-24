# Mosaic platform specification and delivery plan

Status: active
Updated: 2026-11-24

This is the visible source of truth for turning Mosaic into both a local developer
framework and a hosted application-building SaaS. Check a task only when its code,
tests, and documentation are present.

## Product contract

Mosaic supports two paths that produce the same portable application:

1. A developer scaffolds locally, builds with the CLI and Studio, and deploys it.
2. A hosted-Studio user describes an app, edits it visually, optionally connects
   GitHub and Vercel, and deploys it.

Generated apps use one SvelteKit deployment. SvelteKit serves the UI and delegates
`/api/*` to Mosaic's Hono server. PostgreSQL is durable storage: Neon is the default
automated provider, Supabase and generic PostgreSQL are alternatives, and PGlite is
the local default.

### Principles

- Users edit pages, data, and logic, not JSON. JSON is internal and optionally
  available to advanced users and exports.
- Pages, forms, navigation, theme, and application settings are database-first.
- Every entity owns a physical PostgreSQL table; `mosaic_entities` is metadata.
- Every explicit save is immutable, attributable, comparable, and restorable.
- Visual artifact publishes do not require code deployment. Source, package, and
  schema changes do.
- Generated route files are tiny adapters. Runtime logic belongs in public Mosaic
  packages.
- Ordinary Svelte, TypeScript, Hono endpoints, npm packages, and Git are supported
  escape hatches.
- Generated repositories ship agent instructions and framework skills.
- Hosted Studio is a control plane; customer business records remain in the
  generated application's database.

## Ownership boundaries

Database-owned:

- Drafts and revisions for pages, forms, entities, navigation, themes, workflows,
  settings, and endpoints
- Business records, one table per entity
- Users, roles, permissions, audit events, releases, and promotion records

Repository-owned:

- Custom Svelte routes and components
- Component/action registrations and Hono server commands
- Dependencies and lockfile
- Code-owned entity definitions and migration source
- Minimal framework adapters and project-local agent skills

Derived state includes build output, route caches, component registries, preview
workspaces, and generated API metadata. It must be reproducible from a repository
commit and an application release.

## Git-like artifact history

Studio autosaves a mutable working draft. Save creates an immutable revision with:

- artifact kind and stable ID
- monotonic revision and parent revision
- canonical snapshot and SHA-256 checksum
- author, message, origin, and timestamp
- optional release and environment association

Publish points the live app at a committed revision. Restore creates a new forward
revision from old content; history is never rewritten. Concurrent saves use an
expected revision and return a conflict instead of overwriting another author.
Delete creates a tombstone revision.

The UI shows semantic changes such as “Email is now required” and canvas before/
after previews. Developers can inspect a structural diff or exported release.
Entity changes show migration SQL and destructive operations separately.

An application release groups exact artifact revisions with a repository commit and
schema migration. Releases promote from development to preview/staging and
production and provide the rollback unit.

## Generated runtime

Generated files contain no business routing implementation:

```text
src/routes/[[...route]]/+page.server.ts -> createMosaicRouteLoader()
src/routes/[[...route]]/+page.svelte    -> <MosaicRoute />
src/routes/api/[...path]/+server.ts      -> createMosaicApiHandler()
```

Package boundaries:

- `@mosaic-apps/core`: serializable contracts, validation, expressions, diffs
- `@mosaic-apps/server`: DB, auth, artifacts, migrations, CRUD, audit
- `@mosaic-apps/ui`: Svelte component registry and JSON renderers
- `@mosaic-apps/sveltekit`: SSR route/API adapters, auth, SEO, shells

Developers can embed database artifacts in normal Svelte:

```svelte
<MosaicPage name="customer-dashboard" />
<MosaicForm name="customer-create" />
<MosaicForm entity="customer" mode="edit" recordId={id} />
```

Concrete SvelteKit routes override the catch-all. `/api/*` and internal Mosaic paths
are reserved and route collisions are rejected.

## Default complete app

Creation offers a public homepage at `/`, login at `/login`, optional registration
and password reset, an authenticated shell/dashboard, navigation, theme, 403/404/
error pages, entity CRUD workflows, and starter roles. These are ordinary editable
database artifacts. Login can be redesigned, but protected auth actions prevent
visual edits from bypassing authentication.

## Builder UX

Studio has five user-facing areas:

- Build: routes, direct text editing, responsive canvas, layers, inspector,
  reusable sections, accessibility feedback, undo/redo, and AI changes.
- Data: physical entities, relationships, records, workflow generation, and
  migration review.
- Logic: typed actions, conditions, server commands, integrations, retries, and
  audit behavior.
- Preview: user/role/device preview and signed unpublished previews.
- Deploy: environments, diffs, releases, migrations, health, promotion, rollback.

AI proposes structural operations and shows their visual effect before commit. The
normal experience never exposes component IDs, JSON paths, provider credentials, or
deployment internals.

## Extensions and packages

Built-ins cover common applications; custom Svelte is the main escape hatch. A
registration describes the component, inspector fields, bindings, events, defaults,
and environments. Registered components appear in the visual palette.

For a package-backed request, Studio explains the package, modifies `package.json`
and the lockfile in an isolated workspace, generates the smallest needed integration,
runs checks/build, and presents a preview. Arbitrary packages are never installed in
the hosted Studio process. Provider SDKs remain optional adapters.

Astro may later be an output target for content-heavy sites. SvelteKit remains the
default because a deeply nested business-app tree needs one shared interactive
state/action runtime rather than cross-framework islands.

## Local workflow

1. `mosaic create` asks for app type, default pages, auth, and database.
2. PGlite provides durable zero-setup local storage.
3. `npm run dev` starts one application origin plus the local builder.
4. Visual changes autosave to drafts and commit/publish into the local DB.
5. Developers add Svelte, server code, or npm packages normally.
6. CLI commands expose status, diff, history, restore, migration, release, promotion,
   export/import, and deployment without requiring JSON editing.
7. `mosaic deploy` connects/provisions data, applies approved migrations, promotes
   a release, deploys one Vercel project, and runs health checks.

## Hosted SaaS workflow

1. User starts from a prompt or template.
2. AI asks only material questions about domain, users, routes, data, and providers.
3. A sandbox creates source, preview DB, default pages, and a live preview.
4. User edits through chat, canvas, Data, and Logic.
5. Artifact-only changes publish without a build; source/package/schema changes use
   a sandbox build and preview deployment.
6. GitHub App connection optionally creates a repository and pushes source.
7. Vercel OAuth optionally creates one project and deploys it.
8. Mosaic provisions Neon by default or connects Supabase/generic PostgreSQL.
9. Studio shows generation, build, migration, deploy, health, and rollback state.

Without GitHub, source is downloadable. Without Vercel, the user gets a verified
build and instructions. A public data-backed deployment always needs durable data.

## SaaS control plane

The control plane owns organizations, memberships, projects, workspaces,
conversations, generation runs, provider connections, environments, releases,
deployments, usage, billing, and audit. Long operations are durable idempotent jobs.
Builds and dependency installation run in isolated resource-bounded sandboxes.
Secrets are encrypted, scoped, redacted, revocable, and never sent to browser code
or model context.

## Generated-app agent skills

Each scaffold includes `AGENTS.md` and `.agents/skills/mosaic-app/`. The skill routes
agents to concise references for architecture, database-first artifacts, entities/
migrations, custom components/packages, checks, and deployment. It requires agents
to preserve user code, avoid derived output, preview destructive migrations, and
keep secrets out of source. Release checks verify hidden files survive template
packing and scaffolding.

## OpenAPI and generated clients

Orval is an optional code-generation adapter, not a runtime foundation. Use it when
a project imports a stable OpenAPI service or wants a published TypeScript client
and framework-specific query hooks. Keep Mosaic's same-origin client and metadata
contracts authoritative for dynamic pages, forms, entities, revisions, and Studio;
those surfaces can change at authoring time without regenerating application code.
Generated clients live in an explicit source directory, are reproducible from the
committed contract, and are refreshed by a script or release job rather than during
request handling. Projects may choose Orval or another OpenAPI generator without
making generated clients a required dependency of every Mosaic app.

## Security and operations

- Stable secrets, OAuth refresh/rotation, auth and generation rate limits
- Explicit origins, secure headers, and serverless-safe database pooling
- Durable object storage for uploads
- Structured logs and request/job/release IDs, metrics, traces, and audit
- Separate preview data/branches and tenant-isolation tests
- Dependency, secret, and generated-code scanning before deployment
- Database backups plus artifact release export/restore exercises

## Task ledger

### P0 takeover: real prompt-to-running-app pipeline

This is the highest-priority, stop-the-line work. The hosted product is not complete
while a generation job can remain queued without producing and deploying an app.
Do not describe the control plane or blueprint-only flow as end to end.

Required product flow:

1. Accept one natural-language prompt and navigate immediately into the builder.
2. Generate and show an editable plan (routes, physical entities, roles, workflows).
3. Scaffold a complete, ordinary SvelteKit repository with framework agent skills.
4. Create a clean hosted preview and expose both app and API URLs.
5. Run later prompts as durable jobs. Apply database/artifact changes through APIs
   when possible; for source changes, update files, verify, commit, and redeploy.
6. If GitHub is connected, create/push the repository and commit every code change.
7. If Neon is connected, provision/branch PostgreSQL and apply migrations.
8. If Vercel is connected, create/link the project, set secrets, deploy, and track
   status. Provider connections must be real, validated, encrypted, and revocable.
9. Keep the deployed preview visible in an iframe while the job is running. Show
   stages, logs, URLs, failures, and recovery without leaving the builder.

UX contract (informed by Lovable/v0): a focused prompt-first landing screen, then a
two-pane chat/plan + preview workspace with code/files as an optional view. Use
SvelteKit client navigation and enhanced forms/fetch; ordinary calls must not cause
document reloads or hard navigation. Poll or stream durable job state and refresh
only affected data. The user should never need to understand JSON or deployment
internals.

Acceptance gates:

- [ ] One prompt produces a plan, source release, working app URL, and working API URL.
- [ ] A visible preview loads in an iframe before the job completes and refreshes on deploy.
- [ ] No normal create/edit/connect action causes a full document reload.
- [ ] Generated source passes install, check, build, and browser smoke tests.
- [ ] GitHub creates a repo and commit from the exact verified release.
- [ ] Neon provisions durable data and applies the generated migration.
- [ ] Vercel deploys that release and reports preview/production status and logs.
- [ ] A follow-up artifact change publishes through the API; a code change creates a
  new verified release, Git commit, and preview deployment.
- [ ] Closing/reopening the browser resumes the same durable job and preview state.
- [ ] none/GitHub-only/Vercel-only/Neon-only/all-provider paths are tested.

Takeover state on 2026-11-24: the production Cloud control plane, Neon control DB,
Groq planning, accounts, and custom domain exist. A worktree implementation is in
progress for encrypted provider-token connections, generated release/file tables,
deterministic SvelteKit source generation, tar.gz export, and generation tests.
These changes are uncommitted and must be reviewed, completed, and tested. The
current action flow still performs work synchronously and the provider delivery
actions/background runner/live iframe are not complete. Preserve this work; do not
revert it or mark the P0 complete prematurely.

Review on 2026-11-25: the worktree changes were reviewed and fixed (duplicate
dependency, Svelte-markup escaping of model text, long tar paths, preview pages
rendering inside the Cloud chrome, generated app still using the removed
`svelte.config.js`). Cloud tests, check, and build pass; a generated sample app
passes install and check and compiles (the Vercel adapter step needs Linux or the
Windows symlink workaround).

Update on 2026-11-25: create/iterate now enqueue durable jobs and return at once;
`src/lib/server/jobs.ts` claims jobs (one per project, stalled jobs requeued, retry
action) and runs generate → deliver (Neon provision + migration, GitHub commit,
Vercel project/env/deployment) → Vercel status polling. The builder iframe switches
to the Vercel URL once ready and reloads per release. Covered by PGlite tests with
stubbed provider APIs and a local smoke run (no providers). Still unverified
against live GitHub/Neon/Vercel accounts, so the provider acceptance gates stay
open. Known limits: Vercel personal scope only (no team selection), migrations
replay the idempotent initial SQL, generated app does not yet read DATABASE_URL.

### 0. Specification and visibility

- [x] Record the product specification and visible task ledger.
- [x] Publish local, SaaS, source-control, extension, and deployment guides.
- [x] Add ADRs for DB-first artifacts, structured history, one-project runtime, and
  SvelteKit as the default renderer.
- [x] Define one business-app and one passion-app acceptance fixture.

### 1. Revision foundation

- [x] Add generic immutable revisions with parent, checksum, author, message, origin.
- [x] Record page, form, and entity revisions consistently.
- [x] Add list/get/diff/restore APIs with permission and conflict checks. Entity
  restoration intentionally remains migration-reviewed.
- [x] Preserve existing form history during migration and add complete page history.
- [x] Add Studio history, semantic diff, message, conflict, and restore UX.
- [x] Test revision and legacy-history contracts on PostgreSQL and PGlite.

### 2. Agent support

- [x] Ship `AGENTS.md` and a validated project-local `mosaic-app` skill.
- [x] Add artifact, data/migration, extension, and deployment references.
- [x] Verify skills survive CLI packing/scaffolding and add a release check.

### 3. One-project runtime

- [x] Create `@mosaic-apps/sveltekit` and its loader/provider/API contracts.
- [x] Scaffold only minimal catch-all and API adapters.
- [x] Render home, login, arbitrary parameterized routes, shells, SEO, access, and
  an editable 404 artifact from the database.
- [x] Remove per-app Studio and separate API deployment requirements. Studio remains
  an optional local authoring client.
- [x] Make Neon/Supabase pooling serverless-safe with warm-process reuse, explicit
  small pool limits, idle cleanup, and pooled connection guidance.
- [x] Add packed one-project Node, Netlify, and Vercel adapter integration tests.

### 4. Complete intuitive builder

- [ ] Add project/default-page choices and Build/Data/Logic/Preview/Deploy navigation.
- [ ] Add direct editing and robust responsive canvas manipulation.
- [ ] Add route/shell/nav/theme/SEO/access/error/empty-state editing.
- [ ] Add AI structural operations with visual preview and undo.
- [ ] Generate list/detail/create/edit workflows from an entity.
- [ ] Meet keyboard, screen-reader, responsive, and recovery acceptance criteria.

### 5. Extension platform

- [ ] Publish custom Svelte component/action/endpoint registration contracts.
- [ ] Generate inspectors from registration schemas and support artifact embedding.
- [ ] Add sandboxed dependency proposal/install/check/build workflow.
- [ ] Verify developer takeover without hosted Studio.

### 6. SaaS control plane

- [x] Add the hosted SvelteKit control-plane shell with authentication,
  organizations/memberships, projects, environments, durable job records,
  conversations, provider-connection records, and audit events.
- [x] Add the first prompt-to-project workspace with homepage/login choices and a
  responsive conversation, delivery, and job-status experience. Project intent
  records framework, UI system, and theme independently; only implemented runtime
  adapters are selectable.
- [ ] Add AI change operations, isolated workspaces, generation workers, and live
  previews.
- [ ] Add encrypted provider secret operations and tenant-isolation/recovery tests.
- [ ] Add metered usage, plans, billing, quotas, and administrative operations.

### 7. GitHub, database, and Vercel delivery

- [ ] Add GitHub App repo creation, commits, and pushes.
- [ ] Add Vercel OAuth, project/env/deployment/promotion/status flows.
- [ ] Add Neon provisioning/branching and Supabase/generic PostgreSQL connections.
- [ ] Add application releases and environment promotion/rollback.
- [ ] Verify none/GitHub-only/Vercel-only/both connection combinations.

### 8. Documentation and release

- [x] Replace obsolete three-project deployment documentation.
- [ ] Update public docs, package READMEs, and generated project docs.
- [ ] Version changed public packages and validate a packed generated consumer.
- [ ] Run unit, type, build, integration, browser, accessibility, and deploy checks.
- [ ] Push verified focused commits to GitHub.
- [ ] Deploy the hosted SaaS to Vercel and record URL, source commit, configuration,
  health evidence, and rollback procedure.

## Release acceptance

- A non-developer builds and edits a complete authenticated app without opening JSON.
- A developer adds a package-backed custom Svelte component and deploys the app.
- Pages, forms, and entities have attributable history, diff, conflict, and restore.
- The generated repo contains accurate agent skills and passes a clean-agent task.
- One Vercel project serves UI and API against Neon and Supabase test databases.
- Visual publishing avoids a rebuild; code/package/schema changes use preview deploys.
- Backup and rollback recover application artifacts and business data.
