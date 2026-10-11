# Mosaic Platform — Full Execution Plan (Option B)

## Overview
Migrate @mosaic/ui to Tailwind v4 + shadcn-svelte (bits-ui), fix encoding, build Studio file-tree explorer with deep-linked designer routes, add editable sidebar, Svelte transitions, theme/font configurability, entity dropdowns, context menus, keyboard shortcuts — all while keeping generated apps dependency-light via token bridge.

---

## Phase 0 — Encoding repair + finish lucide swap
- Audit every `.svelte`/`.ts` in `apps/studio`, `packages/mosaic-ui`, `templates` for mojibake (CP1252-mangled UTF-8: `â†`, `đź`, `U+FFFD` sequences)
- Fix damaged string literals; replace all remaining raw glyph icons with `<Icon name="…">`:
  - Palette item icons (`Palette.svelte`)
  - Studio Sidebar nav icons + "Sign out" (`Sidebar.svelte`)
  - CanvasNode duplicate/delete buttons (`CanvasNode.svelte`)
  - Form designer toolbar (undo/redo/JSON/Preview)
  - Menu trigger label, JsonView expand/collapse
  - Alert/Toaster/Modal/Drawer/Stepper/DataTable glyphs
- Add `.editorconfig` (`charset = utf-8`)

---

## Phase 1 — Tailwind v4 + shadcn-svelte foundation
- `@mosaic/ui`: `@import 'tailwindcss'` as CSS entry; `@theme` mapping so `--m-*` tokens become Tailwind namespaces — one token set drives both systems
- Deps: `bits-ui`, `tailwind-variants` (cva), `clsx`, `tailwind-merge`; add `cn()` util
- Vendor shadcn-svelte components into `packages/mosaic-ui/src/shadcn/` (context-menu, dialog, dropdown-menu, sheet, popover, tooltip, sonner, input, select, switch, checkbox, slider, tabs, table, badge, card, skeleton, spinner, etc.)
- Token bridge: shadcn vars (`--background`, `--primary`, `--radius`…) derive from `--m-*` so existing apps work during migration
- Studio + template web get `@tailwindcss/vite`; consume the new style entry

---

## Phase 2 — Rebuild mosaic-ui on shadcn/bits-ui primitives
- **Export surface stays identical** (same names in `index.ts`) so studio/template don't break mid-migration
- Order: overlays (Modal/Drawer/Menu/Toaster) → inputs → DataTable → remaining
- Legacy CSS-only implementations parked in `legacy/`, deleted at the end
- Every rebuilt component accepts transition props (wired in Phase 4)

---

## Phase 3 — Editable sidebar (runtime app nav)
- Core: `NavItemDef { label, href, icon, section? }`
- Server: public `GET /api/nav` backed by `app.nav` settings JSON, fallback to default nav
- Studio: new **Navigation** editor (add/remove/reorder, label, href, lucide icon picker, section grouping, live preview) → saves settings
- Template web sidebar renders nav dynamically from the API (auth-aware sign-in/out preserved)

---

## Phase 4 — Svelte transitions (component + form level)
- Transition type: `{ kind: 'fade'|'slide'|'scale'|'blur'|'none', duration, delay }` — global default in settings (`theme.transition`), per-form override in `form.settings.transition`
- **Form level**: FormRenderer enter transition; **component level**: per-field `in:` with tiny stagger via NodeRenderer; Modal/Drawer/Toaster get real Svelte `transition:` (slide/fade) instead of CSS-only
- Designer canvas: fade/flip on add/remove/move
- Template app: SvelteKit `onNavigate` + `document.startViewTransition` crossfade between routes
- Honor `prefers-reduced-motion`

---

## Phase 5 — Studio explorer + UX
### Route structure
- **`/studio`** — explorer shell: file tree left, welcome/recent right
- **`/studio/forms/[id]`** — tree + form designer for the selected form
- **`/studio/pages/[id]`** — tree + page designer
- Old `/design/forms/*` and `/design/pages/*` → redirect to matching `/studio/...`

### File tree
- **Data model**: new `folder` text column (path like `"sales/quotes"`) on `mosaic_forms` + `mosaic_pages`; `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in platform bootstrap so existing DBs upgrade in place
- Tree shows **Forms/** and **Pages/** roots with user folders nested; drag item onto folder to move; folder context menu (rename, new subfolder, delete → items to root)
- Item context menu: Open, Duplicate, Move to…, Delete
- **Search box** filters tree by name/slug, flat results while typing
- Tree/inspector panes **resizable** (paneforge from shadcn stack)
- Designer header shows folder breadcrumb + name; folder dropdown to move artifact

### Studio UX details
- **Context menu** (shadcn) on CanvasNode + LayersTree: Duplicate, Delete, Copy ID, Copy JSON
- **Shortcuts**: Backspace/Delete removes selection (never root; ignored while typing in inputs), Cmd/Ctrl+D duplicate
- **Entity dropdowns**: form entity field (`design/forms/[id]`) and ref-field `refEntity` (`EntityFields.svelte`) become SelectField from `GET /api/entities` with "— none —" option
- **Theme editor** (Settings → Theme tab): full token set (colors, radii, font, spacing), preset gallery, live preview, save → settings API — built with shadcn components
- **Fonts**: configurable `theme.font` / `theme.mono` for generated apps; Studio hardcodes Inter via `apps/studio/src/app.css` pinning `--m-font: 'Inter'…`

---

## Phase 6 — Verify + regression
- Restart stack; CDP screenshots: Studio designer (clean icons, context menu), theme editor, nav editor, runtime form with transitions, edited sidebar
- Workspace `npm run typecheck`, `npm run build`, all test suites pass

---

## Risk mitigations
- shadcn CLI targets app structure → vendor manually into package
- bits-ui / Svelte 5 runes compatibility (both current)
- Sample-crm visually intact through Phases 1–2 via token bridge (`--m-*` → shadcn vars)

---

## Confirmation
Execution authorized by project owner.
## Execution status (2026-10-11)

Execution was authorized by the project owner. Phases 0, 1, 3, 4, and 5 are implemented in the working tree; Phase 6 validation passes (workspace typecheck: 0 errors, production build, 53 unit tests, and 21 integration checks). The 502 was caused by starting Studio without its API; `npm run dev` now starts both services and the Vite `/api` proxy responds successfully.

Phase 2 is in progress: the Tailwind v4/shadcn-svelte foundation compiles cleanly. Modal, Drawer, Menu, SelectField, Switch, and Checkbox use Bits UI primitives. Mosaic Button, TextField, and TextArea render through vendored shadcn button/input/textarea wrappers, preserving Mosaic props and token styles; wrappers are exported from @mosaic/ui. Remaining legacy components are tracked in Phase E. Workspace typecheck and production build pass. Authenticated Button drag/save/publish browser smoke passed with no runtime exceptions.

The explorer displays both Forms and Pages roots, with their respective folders and artifact actions. Integration coverage now exercises public nav/theme defaults and form folder create/rename/delete behavior.

The feedback layer now routes Mosaic toast calls through Sonner, preserving the existing store API, and the exported Tooltip is restored on Bits UI with floating content styling. Current verification after these changes: workspace typecheck and Svelte checks pass with 0 errors and 0 warnings; unit tests pass (53); integration checks pass (21); production build succeeds. Live dev checks return HTTP 200 for `/studio`, `/api/health`, `/api/nav`, and `/api/theme`.

---

## Next-generation form platform plan (source of truth for the next agent)

The project owner has expanded the product requirements. Treat this section as the active roadmap; do not mark a phase complete from typecheck alone. Start with the reported Button drag/drop 500 and collect the failing request/stack trace. Keep this plan current with code, migrations, tests, and screenshots as each phase lands.

### Product invariants

- Form authoring has one primary action: **Save** persists the current definition and publishes it. A successful save updates the visible live version and preview. Keep version history and audit events; do not create duplicate versions for unchanged definitions. If drafts are needed later, make draft state explicit instead of adding a second confusing publish button.
- Preview is an inline canvas mode, never a modal. Switching modes preserves selection, inspector tab, scroll/viewport, and unsaved local work.
- A component can configure data binding, visibility/disabled expressions, events/actions, and appearance. Actions use a typed, documented runtime API for API calls, messages, navigation to a selected form/page, and script execution. Navigation targets come from searchable artifact pickers; do not make users type opaque IDs/slugs.
- Script editing uses Monaco with offline assets, a typed API surface, diagnostics, safe runtime limits, and an explicit security boundary. Never evaluate arbitrary scripts on the server. Define whether scripts run in an isolated browser worker before enabling them for published public forms.
- Entity-bound fields offer autocomplete from entity columns but still allow a custom binding. Show unknown/custom bindings distinctly and validate collisions and nested paths.
- Studio state is an explicit state layer: selected artifact, loaded/persisted version, dirty state, selection, undo/redo, preview mode, in-flight saves, and errors. Changes are undoable; asynchronous saves are serialized or revision-checked to prevent stale writes. Provide recovery for unsaved work.
- The runtime theme system supports named light/dark/custom themes, system preference, theme selection persistence, and scoped `data-theme` behavior. The editor exposes semantic tokens, presets, preview, typography, radius, and brand assets (logo upload with validation, storage, and generated-app rendering). Follow daisyUI's useful model—named themes, default and prefers-dark choices, nested theme scopes, a theme gallery/custom generator—while retaining Mosaic token compatibility and avoiding a daisyUI runtime dependency. Reference: https://daisyui.com/docs/themes/.
- Each form/page has SEO metadata (title, description, canonical URL, robots, social/Open Graph image/title/description, and favicon/brand defaults where appropriate); render it in generated runtime document head, validate lengths/URLs, and keep private designer routes out of indexing.
- Expand the palette with a curated set of shadcn-svelte/Bits UI components. Components must be schema-serializable, keyboard accessible, renderer-safe, and have defaults plus usable inspector controls. No component may crash when rendered without optional children.
- Keep the Studio sidebar editor (already started) and make it cover hierarchy, grouping, ordering, icons, visibility, and selected-route preview; publish its changes through settings without breaking auth-aware links.

### Phase A — Reproduce and eliminate Button drop failure (blocking)

1. Reproduced a palette Button drop in authenticated Studio, confirming the canvas node, Save/publish, API persistence, and absence of browser exceptions.
2. Fixed the root cause and added API regression coverage for palette Button -> canvas -> save -> reload -> preview. Button now renders its serializable label without requiring children. Continue auditing registered components for safe defaults in designer and runtime.
3. Keep invalid drops and invalid schemas as user-visible 4xx validation errors; unexpected backend exceptions must be logged with request correlation IDs and never silently masquerade as a component issue.

### Phase B — Form lifecycle and designer state

1. Replace Save + Publish with Save (save and publish atomically from the user's perspective). Make server publish idempotent by comparing canonical persisted content; increment version/snapshot only when content changes. Return the committed artifact and update the client store.
2. Add dirty/saving/saved/error states, serialized save queue or optimistic concurrency token, before-unload recovery, and undo/redo revision invariants.
3. Convert the current preview modal into a canvas mode toggle with device width controls. Preserve editor state on return. Preview unsaved local edits and make save status clear.
4. Add form metadata editor and generated runtime `<svelte:head>` support; deny indexing of Studio/admin/private routes.

### Phase C — Component properties, bindings, actions, and script

1. Build a property schema/control system with common, events, appearance, and validation groups; per-setting visibility/interaction permissions can follow the Shesha pattern where useful.
2. Load entity definitions once into designer context. Binding control is combobox/autocomplete over columns, supports dotted/custom bindings, and reports invalid bindings without blocking intentional custom values.
3. Define versioned serializable action schema: call API (method/url/headers/body/response mapping), navigate to form/page (searchable picker), show message/confirmation, and run script. Add validation and mock/test runner.
4. Integrate Monaco without online CDN requirements. Type its context (`form`, `formData`, `user`, `actions`, `utils`, `page`, `components`, `storage`, `application`, `query`); expose docs/autocomplete and diagnostics. Choose and document a sandbox, timeout, capability allowlist, error reporting, and CSP before public execution.

### Phase D — Theme, branding, and navigation

1. Upgrade `ThemeConfig` compatibly to named themes + active light/dark/system policy + custom semantic tokens. Migrate existing `theme.config` without losing current `--m-*` values.
2. Implement theme gallery, custom theme creation, scoped live preview, independent light/dark editing, import/export JSON/CSS, and accessible contrast checks. Verify generated apps honor system preference and persist user theme choice.
3. Add authenticated asset upload API for logo/brand assets: file type/size limits, safe names, storage abstraction, retrieval URL, replacement/delete behavior. Wire logos to Studio and generated template app.
4. Finish sidebar editor for reorder/group/icon/visibility/route selection and preview it against the actual generated sidebar.

### Phase E — Component catalog and renderer reliability

1. Add a curated multi-component shadcn-svelte set (start with checkbox, radio group, textarea, date picker, popover/calendar, command/searchable combobox, table/data table, alert dialog, tooltip, skeleton, and toast). Keep package exports stable and use Bits UI primitives where a behavioral primitive exists.
2. Add per-component schema fixtures proving default render, inspector edit, JSON round-trip, runtime render, keyboard behavior, and no console errors. Add compatibility migrations for renamed props.
3. Address the remaining Phase 2 migrations in this plan; do not leave Mosaic exports split between incompatible styling/token models.

### Phase F — Platform state and quality

1. Document state ownership and boundaries: server artifact state, client cache, designer draft state, form runtime state, global settings/theme, and per-page state. Add invalidation rules and avoid hidden module-global state for user-specific data.
2. Add component-level integration coverage for save/publish concurrency, stale writes, API action failures, custom bindings, theme switching, asset upload, SEO output, and form navigation. Include migration and upgrade coverage.
3. Run full typecheck/build/unit/integration suites and authenticated browser smoke tests. Capture designer edit/preview, theme editor light/dark, sidebar editor, script autocomplete, and generated form SEO evidence. Update this roadmap with remaining risks before claiming completion.

### External reference reviewed

Shesha 0.46.0 highlights a consistent typed scripting API (`actions.callApi`, `actions.showMessage`, `page.state`, `components`), a shared expression editor, component settings grouped into Common/Events/Appearance, and improved preview/offline editing. Adopt the consistency, typing, editor feedback, and preserve-state ideas; improve on it with a serialized action schema, searchable artifact/entity pickers, stronger sandboxing, automatic save-and-publish, and version-safe recovery. Source: https://github.com/shesha-io/shesha-framework/releases/tag/0.46.0.

### Continuation progress (2026-10-11)

- Phase A root cause fixed in code: Button accepted only a required snippet, but palette-created Button nodes have a serializable `label` prop. It now renders a safe default label as a leaf node. Added an API regression flow that creates/saves/publishes/reloads a form containing a Button node and asserts it returns success.
- Form Save now saves and publishes, while repeated publishing of unchanged form content keeps the same version. Preview is an inline mode and does not use a dialog. Selection/store state remains mounted across the mode toggle.
- Added SEO settings shape and editor controls for title, description, canonical URL, robots, and Open Graph metadata; FormRenderer emits corresponding head tags.
- Binding property uses an autocomplete datalist populated from the selected entity's fields and continues to allow custom strings.
- Added a standalone Bits UI Checkbox to the UI package and designer palette. Theme config now models light/dark/system and separate dark tokens; runtime applies mode-aware CSS vars and the editor exposes mode/dark colors.
- Confirmed after these changes: `npm run typecheck` passes (0 errors/warnings); `npm run build`, unit tests, integration tests pass, including unchanged form publish idempotency. Authenticated Studio browser smoke dragged a Button from the palette into the canvas, saved and published version 2, and observed no browser exceptions. Keep that flow as a regression check.
- Not complete: version-checked draft recovery and transactional save+publish endpoint; script/action model + Monaco + isolation; searchable form/page action picker; logo upload/storage and app-shell rendering; SEO SSR metadata in generated route load; user theme switch/persistence, broad daisyUI-style gallery/custom theme import/export; further shadcn palette additions; state/cache ownership tests; full authenticated screenshots. Next agent should take these in roadmap order, starting with browser smoke and atomic save/publish before scripts/assets.

### Continuation progress: nested forms, image, and state-management focus

- Added an **Embedded form** palette component. It selects another form from a searchable Studio picker, loads it by artifact id at runtime, accepts serializable initial `props`, stores the nested form's values at the component's parent binding, inherits view mode, and suppresses nested submit buttons and document metadata. Child changes flow through `FormRenderer.onchange` into the parent data object. Recursive embedding is blocked, with a maximum depth of eight.
- Added an **Image** display component for forms and pages with source URL, alt text, width/height, object fit, optional link, caption, and a safe empty designer state.
- The existing form runtime holds field values in `FormRenderer.data`; the parent binding now owns the nested value object. This is an initial state contract, not yet the full state-management feature. Next work must define the typed public state API, state scopes (application/page/form/component), persistence, subscriptions, async action lifecycle, reset/undo semantics, serialization and migration, then make Monaco scripts and actions use that API. Avoid arbitrary `eval`; ship script execution only with a documented capability sandbox and limits.
- Implement regression coverage for nested form loading, prop defaults/overrides, value round trip to parent, view mode, missing client/form behavior, recursive embedding protection, and state isolation across instances. Add image default render and inspector JSON round trip.
- Still open from the owner's requirements: optional Visible-when JS/TS editor toggle; Monaco action/editor and safe execution; API/message/navigation action schema; table column autocomplete, CRUD/detail actions and drill-down validation; complete Form Settings ownership; theme presets/custom themes/light-dark-system switching, logo upload, and generated runtime rendering; complete catalog migration and state/cache ownership documentation/tests.
- Keep the remaining work list above synchronized with implementation. The next implementation milestone is a state-management design and typed runtime API, followed by an action schema and sandbox proof-of-concept; do not claim next-generation form authoring complete from component additions or typecheck alone.

### Status audit and handoff (2026-10-11)

The previous continuation notes are historical. Current changes in this pass:

- **Studio 502** was reproduced as Vite remaining available on 4173 while the API was absent on 8787. `scripts/dev.mjs` now starts the API, waits for `/api/health`, then starts Vite. It also supports `PUBLIC_API_URL` for an already-running project API and fails visibly after a 120-second health timeout. Both root `dev:studio` and workspace `studio dev` use this launcher. Manual check: Studio root, proxied health, and proxied nav return 200.
- **Page preview** now switches the page canvas inline; only page JSON remains a modal.
- **Embedded form recursion** now checks ancestor form IDs. The previous implementation accidentally included the selected form itself in the ancestor check and rejected every selection; this is fixed. The root FormRenderer supplies its current form ID so direct and indirect cycles are stopped before loading the repeated form.
- **State-management foundation** is now implemented and exported from `@mosaic/ui`: instance-owned application/page/form scopes, cloned serializable snapshots, set/update/reset, subscriptions and revision counters, forked page/form scopes, serialize/restore, FormRenderer/PageRenderer context integration, and nested form isolation. Unit tests cover immutable snapshots, notifications/revisions, scope sharing/isolation, and restore. This does **not** complete the state requirement: persistence adapters, cross-tab/server synchronization, history/undo integration, async action lifecycle, a typed script API, and component action wiring remain open.
- **npm packaging** now has public scoped publish config, package READMEs, prepack build/check lifecycles, and `npm run release:check`. The CLI template is copied into the package for the pack lifecycle and cleaned afterward. `@types/pg` is a production dependency because published server declarations refer to pg types. No npm publication was performed.
- Docs were refreshed for current Studio lifecycle, forms/pages, embedded forms, state scope/API and limitations, theme capabilities, CLI dev startup, catalog count, and npm package checks. Root docs scripts now correctly target the docs project, which is outside the npm workspace glob.

The plan is **not complete**. Remaining product work, in priority order:

1. Make artifact save-and-publish transactional/version-checked; serialize concurrent saves and add version-checked local draft recovery. The current form Studio still makes two API requests.
2. Add a versioned component action schema for API calls, messages/confirmations, and searchable form/page navigation; connect runtime state scopes and async/error/cancel lifecycle to actions.
3. Integrate offline Monaco, optional visible-when script editor, typed API/state declarations and diagnostics. Do not execute script source until worker/capability sandboxing, time limits, CSP and error reporting are in place. Never use server-side eval.
4. Complete public state persistence policy/adapters and integrate reset, history, route changes, nested validation and stale-write recovery.
5. Finish theme named-palette gallery/import/export, preference persistence and contrast checks; add authenticated logo upload/storage and render uploaded brand assets in generated apps.
6. Finish table-view configurability (column bindings/options, custom actions and per-row CRUD/action schemas), verify detail drill-down and aggregate embedded-form validation.
7. Complete the remaining catalog audit/migrations and add renderer/keyboard/inspector round-trip coverage. Current npm release check verifies tarball contents but does not yet install each tarball into an isolated consumer fixture; do that before the first registry release.
8. Capture authenticated browser regressions for form settings, page inline preview, nested forms and state scope behavior; keep `npm run typecheck`, `npm test`, `npm run e2e`, `npm run build`, `npm run docs:build`, and `npm run release:check` green.

Do not mark these remaining items complete until code, docs, and regression evidence land. The current stack is running from the paired launcher in this working session; restarting with `npm run dev` reproduces the supported startup path.

### Continuation progress: atomic publishing, component actions, and deployment DX (2026-10-11)

- Added `PUT /api/forms/:id/save-and-publish` and the equivalent page route. Each route locks the artifact row, verifies `expectedVersion`, updates the component tree and settings, publishes, and writes the form snapshot in one transaction. Stale tabs receive `409 STALE_VERSION`; unchanged saves keep their version. The client now maps runtime `root` to the server `schema` field, fixing a case where Studio could acknowledge a save without persisting canvas changes. Form and page Studio now expose one **Save** action that publishes automatically.
- Added a versioned serializable component-action foundation for message, same-API call, form/page/URL navigation, and scoped state writes. Studio shows an action editor on every component and uses searchable form/page datalists. Runtime actions have per-component running/succeeded/failed/cancelled state, scoped templates, result mapping, and cancellation via `AbortSignal`.
- Expanded state ownership with isolated component scopes and safe nested `getPath`/`setPath`. Prototype-polluting paths are rejected. Added integration coverage for atomic persistence/idempotency/stale rejection and unit coverage for action results, cancellation and state isolation.
- Added generated deployment support: separate API/web Dockerfiles, optional Netlify adapter, `PUBLIC_API_URL`, restricted `CORS_ORIGINS`, cloud-safe optional `.env` loading, and a provider deployment guide ordered database → API → web. It covers Netlify, Render, Neon, Supabase, Railway, Fly.io, migrations, first-run administration, persistent uploads, health checks, backups and rollback.

Remaining priority work is now:

1. Add encrypted/version-checked local draft recovery and a Studio conflict-resolution flow for `STALE_VERSION`; serialize programmatic save triggers through one queue.
2. Add confirmation actions, action schema validation/migration, richer response mapping, table row action context, and navigation resolution for custom page routes.
3. Integrate offline Monaco and the optional visible-when JS/TS editor, keeping execution disabled until the browser worker capability sandbox, time limits, CSP and error reporting are complete.
4. Add opt-in state persistence adapters, cross-tab coordination, reset/history integration and nested-form aggregate validation.
5. Complete named themes/import-export, preference persistence, contrast checks, authenticated brand asset upload and generated shell rendering.
6. Finish table/detail configuration, the remaining shadcn catalog audit, an isolated generated-project install/build including Netlify, and authenticated browser regressions.

### Continuation progress: Monaco scripting and page-settings parity (2026-10-11)

- Added an inline, offline Monaco editor to component script actions, including
  TypeScript/JavaScript language selection and autocomplete declarations for the
  runtime `state` snapshot and `api` action helpers.
- Added a QuickJS WebAssembly browser-worker sandbox. It exposes no host DOM or
  network objects, transpiles TypeScript inside the worker, enforces CPU,
  memory, stack, source-size, and output-count limits, and only returns
  validated declarative Mosaic actions. Nested script generation is rejected.
- `visibleIf` and `disabledIf` now offer the existing safe expression mode or an
  optional JavaScript/TypeScript mode behind an inline **Code editor** toggle.
  Script conditions use the same sandbox and must return a boolean.
- Page Studio now matches Form Studio: inline preview, dirty/version status, one
  save-and-publish action, before-unload protection, and a dedicated **Page
  settings** view. Page settings own identity, description, route, folder,
  access, layout, motion, sidebar navigation, SEO, and social metadata.
  `PageRenderer` emits the configured metadata.
- Remaining work: encrypted/version-checked draft recovery and conflict UI;
  confirmation and table-row action context; state persistence adapters and
  cross-tab coordination; theme gallery/import/export/contrast checks; brand
  upload and generated shell rendering; richer table/detail configuration;
  remaining catalog audit and authenticated browser regression evidence.

### Continuation progress: Form Studio reliability and settings (2026-10-11)

- Fixed a repeat-start race in `scripts/dev.mjs`: a healthy API on port 8787
  was detected but the launcher still spawned another process, which crashed
  with `EADDRINUSE` and stopped Studio. The launcher now reuses a healthy API,
  verifies the Studio proxy, reuses an already healthy Studio, and uses strict
  ports for new instances. API, Studio, and proxied health all return 200.
- Form settings now own the full form-level configuration exposed by the
  schema: identity/entity, vertical/horizontal/inline layout, 1-4 columns,
  motion, none/entity/static/endpoint data sources, submission labels and
  confirmation/redirect behavior, and SEO/social metadata.
- Form preview applies unsaved settings and data-source changes and provides
  desktop, tablet, and mobile widths. Runtime form layout and `colSpan` now
  render as configured; confirmation, custom failure text, and safe post-save
  redirects are active.
- `Ctrl/Cmd+S` works throughout Form Studio. Saves are serialized: changes made
  during an in-flight atomic publish automatically queue another save and are
  never incorrectly marked as persisted.
