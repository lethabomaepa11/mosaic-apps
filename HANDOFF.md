# MOSAIC — HANDOFF / PROGRESS LOG (read this first)

Next-gen metadata-driven full-stack drag & drop platform for JS/TS.
**Goal: beat Shesha 0.46** (entity→API→JSON-form loop, 40+ components) **+ PWA web apps + rich CLI**, in TS/Hono/Svelte.

## Stack decisions (locked)
- npm workspaces monorepo; TypeScript 6.0.3 (strict, `verbatimModuleSyntax`, NodeNext → **relative imports need `.js` suffix**)
- Backend: Hono 4.13 + `pg` 8 + Zod 4.6; JWT/scrypt hand-rolled on node:crypto
- Frontend: SvelteKit 3.0.1 + Svelte 5.57 + Vite 8 (peer matrix verified); UI package consumed as **source** (no build step)
- Tests: `node --import tsx --test "src/**/*.test.ts"`; docs: Docusaurus 3.10
- Node 26.7, Docker available for Postgres (infra/docker-compose.yml, user/pass/db = mosaic)
- npm 11 gate: esbuild approved via `npm install-scripts approve esbuild` (done)
- tsconfig quirk: TS6 needs `"types": ["node"]` in tsconfig.base (done)

## DONE
### P1 root
- package.json (workspaces packages/* apps/* docs, scripts: build/typecheck/test/dev:api/db:up/docs/e2e), tsconfig.base.json, .gitignore, infra/docker-compose.yml (postgres:16-alpine)

### P2 @mosaic/core ✅ 22/22 tests, builds
- types: EntityDef/FieldDef (string,text,int,decimal,bool,date,datetime,enum,json,ref,file,id + formats), FormDef/FormNode (generic tree; UI owns registry), PageDef, platform types (User/Role/Audit/RefList/Setting/Migration plan)
- `form/tree.ts` walk/find/insert/move(validate-first)/duplicate/clone/bindings/ensureRoot
- `expression/` sandbox mini-language (lexer/parser/interpreter, no eval; whitelisted methods, blocked constructor/__proto__) — `evaluateExpression/tryEvaluate/evaluateBoolean` for visibility rules/defaults
- `query.ts` parseQuery (page clamps, sort `-field`, json `filter`, `where=field:op:v`, in/between) + buildQueryString
- `entity/defaults.ts` demo entities: employee, customer, product, order (refs+enums+soft delete)
- ids.ts (newId/uuid/slugify), validateEntity, systemFields (id/createdAt/updatedAt/deletedAt)

### P3 @mosaic.server ✅ typechecks clean (src+tests)
- db/driver.ts (Db iface, PgDriver pool, tx, ident()), db/introspect.ts (SchemaSnapshot from information_schema + pg_catalog)
- migrate/ddl.ts (field→PG mapping, constraint naming `t_c_key/_enum_check/_fkey/_idx`, normaliseDefault)
- migrate/engine.ts **3-phase diff**: A structure (create/add/alter) → B drops (only columns in `mosaic_entity_columns`; else warning) → C constraints/indexes **always planned incl. new tables**; diffEntities removes FK adds whose target is missing (warns); checksumStatements()
- migrate/runner.ts computePlan/applyPlan (single tx → mosaic_migrations records → replaceKnownColumns)/migrationHistory
- entities/registry.ts (mosaic_entities CRUD, fs sync `*.entity.json`, known columns, EntityRegistryError)
- validation/zod.ts buildEntitySchema(create|update) + formatIssues (regex formats, avoid zod API drift)
- crud/sql.ts WhereBuilder (?→$n), buildWhere (typed casts, ILIKE escaping, soft-delete guard), buildListSql (include→LEFT JOIN + `<ref>_label`, default sort updatedAt DESC/id ASC), countParams, buildInsertSql/UpdateSql, buildOptionsSql
- crud/router.ts `/api/entities`: registry list, /:name/meta, /:name/options, list (parseQuery), :id, POST, PATCH/PUT shared handleUpdate, DELETE (?force); canAccessEntity gates; audit; JSON envelope
- modules/: auth.ts (scrypt+HS256+resolveUser), auth-routes (login/register bootstrap/me/logout/change-password), rbac.ts (wildcard matchPermission; admin bypass; explicit `entity:*:action` perms override entity.roles gate; `['*']` in entity.permissions allows any authenticated), http.ts (ok/fail/HttpError/mapDbError/readJson, 413 incl), audit.ts, artifacts.ts (forms+pages generic CRUD, publish → version++ + mosaic_form_versions snapshot, published-by-slug anonymous read), settings.ts, reflists.ts, users.ts (users+roles admin), migrations-routes.ts (GET plan dry-run, POST apply {allowDestructive,only} perm migrations:run, GET history), files.ts (multipart ≤15MB, /api/files + public /files/:id), meta.ts (/api/health, /api/meta), entity-admin.ts (POST validate, PUT :name + onChange registry bust, DELETE keeps table; perm entities:manage)
- platform.ts (mosaic_* DDL, DEFAULT_ROLES admin/editor/viewer, RESERVED_ENTITY_NAMES)
- seed.ts + seed-demo.ts (customer-form, order-form, dashboard page, ticket-priority/yes-no reflists; DEFAULT admin admin@mosaic.local/admin1234)
- app.ts createMosaicServer(config) mounts everything + registry cache; dev.ts on :8787
- Tests: migrate/engine.test, crud/sql.test, validation/zod.test, modules/auth.test

## IN PROGRESS — test fixes (diagnoses complete)
1. engine.ts phase-C-for-new-tables bug: **FIXED this session** + FK-removal in diffEntities: **FIXED**
2. Remaining test edits pending:
   - engine.test #1 → diff `[employee, base]`, select plan by entity==='customer', FK assert stays
   - engine.test missing-ref → assert NO `FOREIGN KEY` statement planned
   - engine.test converged fixture → `deletedAt` dataType must be `timestamp with time zone` (currently 'text' → spurious ALTER TYPE)
   - sql.test regexes → alias quotes `/"t"\."name"/`; `IN ($3, $4)` has NO casts; insert `("name", "age")`; count `/count\(\*\)::int/`
   - auth.test → editor `entity:*:create` legitimately grants guarded create; change editor perms to `['entity:*:read']`
   - zod.test update-mode rejects `{}` → DEBUG live, likely `.nullable().optional()`/preprocess order in withNullability
3. Then: full server typecheck + tests green → `tsc -p tsconfig.json` dist build → root `npm test`.

## STATUS UPDATE (session 2) — ALL test fixes DONE, server ✅
- Server: **23/23 tests green, dist built**. Fixes: engine phase C now always runs (new tables get unique/FK/check/index); diffEntities strips FK adds whose target table won't exist (warns); zod json fields go through withNullability (zod4: `z.unknown()` object keys need `.optional()`); rbac specificity rule (entity role gates beat broad `entity:*:` wildcards; exact `entity:<name>:*` grants override; admin bypass); sql/engine/auth test expectations corrected.
- Core: 22/22 green. Total 45 tests.

## IN PROGRESS — P5 @mosaic/ui
- package.json (exports "." → src/index.ts, "./style.css", "./client"), tsconfig (Bundler resolution) written.
- styles/theme.css (tokens + base + buttons) + styles/fields.css (form controls) written.
- Remaining UI files: styles/components.css (surfaces/tables/modals/toasts/charts), client/api.ts (MosaicClient), dnd/dnd.svelte.ts (module $state drag store) + draggable/dropzone actions, registry/types.ts + registry/index.ts (~57 entries), components/*.svelte (~40 files), render/FormRenderer.svelte, render/PageRenderer.svelte, EntityForm/EntityTable, Toaster + toast store, src/index.ts barrel (imports css).

## TODO (ordered)
1. **P5 finish @mosaic/ui** (see plan above)
2. **P4 @mosaic/cli** — `packages/mosaic-cli`, bin `mosaic`: `create <name>` with args `--db <url> --auth on|off --demo/--no-demo --pwa/--no-pwa --port --web-port --package-manager --install/--no-install --git/--no-git --link <repo>` via node:util parseArgs; token-replace + rewrite `@mosaic/*` to `file:` abs paths (auto-detect repo by walking up for `templates/fullstack`); `dev`, `entity <Name> --fields "a:string,b:int" --soft-delete`, `migrate`, `seed [--demo]`, `studio`, `info`, `help`.
3. **P7 templates/fullstack** (write BEFORE testing CLI): apps/api (Hono bootstrapping @mosaic/server, entities/*.entity.json, mosaic.config.json), apps/web SvelteKit **PWA** (manifest.webmanifest, sw.js: precache shell + network-first /api + offline fallback page, icons 192/512, registerSW in layout), docker-compose, .env.example, README. Token placeholders `__PROJECT_NAME__` etc.
4. **P6 apps/studio** — SvelteKit designer (PWA too): dashboard, form designer (palette/canvas nested drop zones/inspector/layers/undo-redo/JSON/preview), page designer, entity designer (field editor → Plan SQL → Apply → data browser), migrations, API explorer, settings, login. Vite proxy `/api`→8787; `$ui` alias to package src.
5. **P8 docs/** Docusaurus: intro, quickstart, architecture, cli, entities, migrations, auto-crud ref, form-json spec, builder, **component catalog**, **PWA guide**, theming, security, deployment, **shesha-0.46 comparison**, abp comparison, recipes, faq.
6. **P9 verify**: root typecheck/build/test; docker PG e2e (boot → seed → login → CRUD → publish form → migration plan/apply via HTTP); studio build; docusaurus build; `mosaic create` smoke test; keep HANDOFF.md updated.

## SESSION 3 STATUS
- **e2e 19/19 PASSED** (`npm run e2e`). Unit tests: core 22 + server 23 = 45 green.
- PGlite driver added: `DATABASE_URL=pglite://memory` (dev.ts default) — embedded Postgres WASM, zero external DB; `ensurePlatformTables` executes DDL statement-by-statement (PGlite rejects multi-statement prepared queries); introspect normalises regclass quotes for reserved-word tables (`"order"`).
- **P5 @mosaic/ui DONE** (57 component types): styles/{theme,fields,components,overlays,misc}.css; client/api.ts (MosaicClient); dnd/dnd.svelte.ts (dragState/draggable/dropzone/hitTest); registry/{types,entries-inputs,entries-inputs-b,entries-data,entries-layout,entries-display,entries-feedback,entries-nav,index}.ts; ~40 components; render/{NodeRenderer,FormRenderer,EntityForm,PageRenderer}.svelte; stores/toast.svelte.ts; index.ts.
- **P7 templates/fullstack DONE**: apps/api + apps/web (SvelteKit **PWA**: manifest, sw.js network-first /api + offline.html, make-icons.mjs PNG icon generator). Tokens: __PROJECT_NAME__, __PROJECT_SLUG__, __DB_URL__, __AUTH__, __PWA__, __DEMO__, __API_PORT__, __WEB_PORT__, __DB_PORT__.
- **P4 @mosaic/cli DONE** (typechecks + builds + help verified): `create <name>` with --db/--auth/--demo/--pwa/--port/--web-port/--db-port/--pm/--install/--git/--link/--npm-mode/--force; migrate (dry-run SQL preview), seed, entity (--fields "name:string,price:decimal,owner:ref:employee,status:enum:a|b", --soft-delete), info, studio.

## NEXT: P6 apps/studio (SvelteKit 3 designer app)
- package.json: @sveltejs/kit ^3.0.1, vite ^8.3.4, @sveltejs/vite-plugin-svelte ^7.3.1, svelte ^5.57.2, @sveltejs/adapter-node ^5.5.2, svelte-check ^4.7.6, typescript ^6.0.3; deps @mosaic/core + @mosaic/ui "0.1.0" (CLI rewrites to file:)
- vite.config.ts: alias $ui → ../../packages/mosaic-ui/src/index.ts; server.proxy /api + /files → PUBLIC_API_URL ?? http://localhost:8787; port 4173
- routes: +layout.svelte (sidebar + Toaster + auth store), +page.svelte (dashboard), login/, design/forms/ + design/forms/[id]/ (DESIGNER: Palette | Canvas | Inspector | Layers; undo/redo; JSON tab; preview; save/publish/delete), design/pages/ + [id]/, data/entities/ + data/entities/[name]/ (field editor + migration plan/apply + EntityTable browser + EntityForm modal), data/migrations/, api/ (explorer), settings/ (users/roles/reflists/audit/settings)
- components: Sidebar, Palette, Canvas (nested dropzones + insertion indicator + selection outline + draggable nodes), Inspector (registry descriptor → control factory), LayersTree, designer store (.svelte.ts with undo/redo snapshots)
- After: P8 Docusaurus docs (workspace mosaic-docs) + P9 final verification (root build/test/e2e, studio build, docs build, create smoke test)

