---
name: mosaic-app
description: Build, modify, diagnose, or deploy an application scaffolded with Mosaic. Use for Mosaic pages, forms, entities, migrations, custom Svelte components, server extensions, packages, Studio behavior, or deployment. Do not use for unrelated SvelteKit projects.
---

# Mosaic app

Make the smallest complete change through Mosaic's public contracts. Preserve
user-written code and keep each kind of state with its owner.

## Ownership

- Pages, forms, navigation, theme, and visual settings are database-first. Use the
  Mosaic client/API or Studio; do not add live filesystem JSON copies.
- Business entities have physical PostgreSQL tables. Entity metadata drives
  validation, CRUD, migrations, and UI generation.
- Custom UI belongs in ordinary Svelte files and is registered with Mosaic.
- Server invariants and secrets belong in authorized server commands/endpoints.
- `package.json` and its lockfile own dependencies.
- Generated build output and runtime caches are derived; do not hand-edit them.

## Route the task

- Pages, forms, routes, publishing, history: read
  [references/artifacts.md](references/artifacts.md).
- Entities, records, or migrations: read
  [references/data.md](references/data.md).
- Custom components, actions, endpoints, or packages: read
  [references/extensions.md](references/extensions.md).
- Verification, environments, or deployment: read
  [references/delivery.md](references/delivery.md).

Read only the references needed for the current request.

## Always preserve

- Validate input and authorization on the server even when Studio validates it.
- Treat migration drops and type narrowing as destructive and require explicit
  approval from the application's normal migration workflow.
- Keep provider credentials in environment variables; never expose them through
  `PUBLIC_*` variables or logs.
- Prefer an existing Mosaic component/helper and installed dependency before adding
  another abstraction or package.
- Add one focused test for new non-trivial behavior and run the closest existing
  checks before the full build.
