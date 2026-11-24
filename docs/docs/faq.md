---
sidebar_position: 16
---

# FAQ

**Do I need Docker or Postgres installed?**
No. `DATABASE_URL=pglite://memory` boots real Postgres compiled to WASM.
Use a server Postgres for teams/production.

**Where is my data model stored?**
`apps/web/src/lib/server/entities/*.entity.ts` classes (or `*.entity.json`) in git
(reviewable), synced into `mosaic_entities` at boot; the physical schema lives
in Postgres.

**Can I write custom endpoints?**
Yes — customize the provider in `apps/web/src/lib/server/mosaic.ts`, await
`createMosaicServer(...)`, and mount extra Hono routes before returning the server.

**Can components be extended?**
Register more types via `COMPONENTS.push(...)` before rendering (custom
palette entries with `inspector` descriptors show up in Studio after a
rebuild), or build standalone Svelte components consuming `MosaicClient`.

**How do renames work?**
A rename is planned as drop + add (destructive). For zero-downtime renames,
add the new column, backfill, then remove the old one in two migrates.

**Is the Studio required?**
No. Pages and forms are database artifacts — manage them through the API or CLI and
render them with Mosaic components in ordinary Svelte.

**Offline writes?**
Reads work offline out of the box; write queues are app-specific (see
[PWA guide](./pwa.md)).
