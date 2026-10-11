---
sidebar_position: 3
---

# Architecture

## Metadata is the source of truth

Everything Mosaic serves derives from three JSON families:

```
entities/*.entity.json      → tables, CRUD, validation, zod schemas
mosaic_forms (DB row)       → component trees rendered by FormRenderer
mosaic_pages (DB row)       → dashboards rendered by PageRenderer
```

There is no codegen step and no drift: the API introspects the same metadata
the Studio edits.

## Packages

```mermaid
flowchart LR
  core[@mosaic/core<br/>types · validation · query spec · expressions]
  server[@mosaic/server<br/>Hono API · CRUD · auth · migrations]
  ui[@mosaic/ui<br/>57 components · FormRenderer · DnD]
  cli[@mosaic/cli<br/>mosaic binary]
  studio[apps/studio<br/>designer]
  template[templates/fullstack<br/>scaffold]

  core --> server
  core --> ui
  server --> cli
  ui --> studio
  ui --> template
  server --> template
```

- **`@mosaic/core`** — pure TS, zero runtime deps: entity/form/page types,
  `validateEntity`, zod schema builder input, `QuerySpec` (`buildQueryString`),
  expression interpreter (`visibleIf`/`disabledIf`), tree helpers
  (`insertNode/moveNode/removeNode/duplicateNode/walk/ensureRoot`).
- **`@mosaic/server`** — Hono app factory `createMosaicServer()`. Pluggable `Db`
  drivers (`pg` pool or PGlite WASM via `createDb(url)`). Platform tables
  (`mosaic_*`), artifact stores (forms/pages with version snapshots),
  entity admin, users/roles/RBAC, audit, settings, ref lists, files.
- **`@mosaic/ui`** — Svelte 5 kit. Components consume one contract:
  `value` + `oninput` + `error`; `NodeRenderer` bridges registry types to
  components, strips `binding/visibleIf/disabledIf/colSpan`, and injects
  `client` for live components (`EntityTable`, `StatCard`, `RefSelect`).
- **`@mosaic/cli`** — zero interactive deps; `parseArgs`-based dispatcher.
- **Studio** — a regular SvelteKit app consuming `@mosaic/ui` from source.

## Request lifecycle (CRUD)

```
fetch → Hono route → requirePermission → validateEntity/zod → build*Sql
→ driver.query (pg|pglite) → writeAudit → envelope { success, data }
```

Errors are normalised: validation → 422 `VALIDATION`, uniques → 409
`UNIQUE`, missing rows → 404 `NOT_FOUND`, RBAC → 403 `FORBIDDEN`.

## Data model (platform tables)

`mosaic_entities` (registry + JSON definition), `mosaic_entity_columns`
(known columns — the "safe drop" allow-list), `mosaic_migrations`
(checksum + statements + status), `mosaic_forms` + `mosaic_form_versions`,
`mosaic_pages`, `mosaic_users` + `mosaic_roles`, `mosaic_settings`,
`mosaic_ref_lists`, `mosaic_files`, `mosaic_audit`.
