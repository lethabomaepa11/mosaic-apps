---
title: Architecture
---

# Architecture

A Mosaic app runs on SvelteKit or Next.js and exposes a same-origin Hono API. PostgreSQL stores users, metadata, and business tables. PGlite runs embedded PostgreSQL for local development.

## What owns each layer

| Layer | Responsibility |
| --- | --- |
| `@mosaic-apps/core` | Shared entity, form, and page types, entity loading, decorators, and expressions |
| `@mosaic-apps/server` | Hono API, validation, CRUD, migrations, sessions, permissions, and artifact publishing |
| `@mosaic-apps/ui` | Svelte component registry, canvas building blocks, API client, and runtime state |
| `@mosaic-apps/sveltekit` | Same-origin API and database page routing for SvelteKit |
| `@mosaic-apps/cli` | App scaffolding, entity commands, migrations, seeding, and local launch commands |
| Mosaic Cloud | Prompt refinement, generation, preview environments, and delivery |

## How data reaches the UI

1. Entity definitions live in source files or in the registry. They describe fields, relations, validation, and permissions.
2. The migration engine compares registered definitions with the database. A reviewed migration updates the physical schema.
3. CRUD routes authorize the caller and validate input before evaluating parameterized SQL.
4. Published form and page records describe the UI the runtime renders. The frontend uses the API for live record data.

Both scaffolds include visual Studio and use the framework's Svelte page and form renderers for published artifacts. Next.js owns routing, authentication, and the React app shell, and mounts the framework renderer inside the shell. Cloud Preview Studio uses the shared preview renderer for both targets. [Local and hosted workflows](./workflows.md)

## Runtime state

Svelte runtime state is scoped to the application, page, form, and component. Embedded forms share application and page scope while holding their own form state. Browser scripts run in an isolated worker and return declarative actions. [Runtime state](./state-management.md)
