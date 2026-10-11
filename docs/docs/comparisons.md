---
sidebar_position: 14
---

# Comparisons

## vs Shesha (v0.46)

Shesha pioneered the metadata-driven React/.NET low-code space Mosaic learns
from. Honest differences:

| | Shesha 0.46 | Mosaic |
|---|---|---|
| Backend | ASP.NET + ABP framework | Hono + Postgres, framework-light |
| Frontend | React + Ant Design | Svelte 5 + bespoke `.m-*` kit |
| Model | C# entities + migrations | JSON entities, diff-computed SQL (no migration files) |
| Forms | React designer | Svelte designer, same-tree JSON renderer |
| Offline | not a focus | PWA-first: offline shell + offline reads |
| Dev DB | SQL Server required | PGlite embedded Postgres, zero setup |
| Auth | ASP.NET Identity + ABP permissions | JWT + string-permission RBAC with specificity rules |

Choose Shesha for .NET/AntD shops; choose Mosaic for a smaller, JS-native
footprint with offline PWAs.

## vs ABP Framework

ABP is a full application framework (modularity, multi-tenancy, DDD
building blocks). Mosaic is narrower: it skips the framework ceremony and
generates the app from the model. If you want DDD modules and tenants,
ABP fits; if you want "entities in, CRUD app out", Mosaic is faster.

## vs Retool / Appsmith / Budibase

Those are excellent *internal-tool builders* on top of *your* database.
Mosaic owns the whole stack (schema + API + UI + PWA) from one model, so
migrations, validation, RBAC and audit stay consistent by construction —
at the cost of committing to the Mosaic runtime.
