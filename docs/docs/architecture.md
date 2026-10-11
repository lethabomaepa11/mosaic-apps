---
sidebar_position: 3
---

# Architecture

## Metadata is the source of truth

Mosaic stores entity definitions, form component trees, and page component trees
as metadata. The API derives validation, migrations, CRUD, and runtime artifacts
from those definitions; Studio edits the same form/page records applications
render.

## Packages

```mermaid
flowchart LR
  core[@mosaic-apps/mosaic-core<br/>metadata and shared logic]
  server[@mosaic-apps/mosaic-server<br/>Hono API and database]
  ui[@mosaic-apps/mosaic-ui<br/>Svelte 5 components and renderers]
  cli[@mosaic-apps/mosaic-cli<br/>mosaic binary]
  studio[apps/studio<br/>designer]
  template[templates/fullstack<br/>scaffold]
  core --> server
  core --> ui
  server --> cli
  ui --> studio
  ui --> template
  server --> template
```

- **`@mosaic-apps/mosaic-core`** contains shared types, expression parsing, tree helpers,
  entity decorators, and entity loading. Server-side decorators use
  `reflect-metadata`; TypeScript entity loading can use `tsx`.
- **`@mosaic-apps/mosaic-server`** exports a Hono app factory, PostgreSQL and PGlite
  drivers, platform tables, entity administration, CRUD, auth/RBAC, audit,
  settings, reference lists, form/page artifacts, and file endpoints.
- **`@mosaic-apps/mosaic-ui`** is a source-first Svelte 5 library with the component
  registry, FormRenderer/PageRenderer, API client, shadcn-svelte/Bits UI
  primitives, and an instance-scoped runtime state API. Consumers need Svelte 5
  and Tailwind CSS 4 in their build.
- **`@mosaic-apps/mosaic-cli`** provides the `mosaic` executable and bundles the full-stack
  project template into its npm tarball during `prepack`.
- **Studio** consumes UI source directly. Run `npm run dev` from the repository
  root to start API and Studio together. The launcher waits for `/api/health`
  before starting Vite, preventing startup-order proxy 502 responses.

## Runtime state

Each application session can own a `MosaicState` instance with application,
page, and form stores. PageRenderer creates or accepts that instance;
FormRenderer forks a form scope, and embedded forms share application/page
scopes but get isolated form scopes. Updates are revisioned and observable;
snapshots can be serialized and restored. State is in-memory only. Persistence,
cross-tab synchronization, action execution, and Monaco scripts are not shipped
yet; see [State management](./state-management.md).

## Request lifecycle (CRUD)

```text
fetch -> Hono route -> permission check -> Zod validation -> SQL builder
      -> PostgreSQL/PGlite driver -> audit -> { success, data } envelope
```

Validation failures return 422, unique conflicts 409, missing records 404, and
authorization failures 403.

## Platform tables

The platform stores entities, known entity columns, migrations, forms and form
versions, pages, users and roles, settings, reference lists, files, and audit
records in `mosaic_*` tables.
