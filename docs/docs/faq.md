---
sidebar_position: 16
---

# FAQ

**Do I need Docker or Postgres installed?**
No. `DATABASE_URL=pglite://memory` boots real Postgres compiled to WASM.
Use a server Postgres for teams/production.

**Where is my data model stored?**
`apps/api/src/entities/*.entity.ts` classes (or `*.entity.json`) in git
(reviewable), synced into `mosaic_entities` at boot; the physical schema lives
in Postgres.

**Can I write custom endpoints?**
Yes — mount extra Hono routes in `apps/api/src/index.ts` next to
`createMosaicServer(...).app`. The platform router is just Hono.

**Can components be extended?**
Register more types via `COMPONENTS.push(...)` before rendering (custom
palette entries with `inspector` descriptors show up in Studio after a
rebuild), or build standalone Svelte components consuming `MosaicClient`.

**How do renames work?**
A rename is planned as drop + add (destructive). For zero-downtime renames,
add the new column, backfill, then remove the old one in two migrates.

**Is the Studio required?**
No. Forms/pages are JSON rows — create them via `POST /api/forms` and
render with `FormRenderer` anywhere.

**Offline writes?**
Reads work offline out of the box; write queues are app-specific (see
[PWA guide](./pwa.md)).
