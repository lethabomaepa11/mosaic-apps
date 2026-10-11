---
sidebar_position: 7
---

# Auto CRUD reference

Every registered entity exposes the same REST surface at
`/api/entities/:entity`. All responses use the envelope
`{ success: true, data }` (errors: `{ success: false, error: { message, code, details } }`).

## Endpoints

| Method & path | Purpose |
|---|---|
| `GET /api/entities` | Registry (name, label, version, rowCount) |
| `GET /api/entities/:e/meta` | Entity + fields + endpoints + query capabilities |
| `GET /api/entities/:e/options?q=&limit=` | `{ value, label }` picker data |
| `GET /api/entities/:e` | List (see query below) |
| `GET /api/entities/:e/:id` | Single record (`?include=owner`, `?withDeleted=true`) |
| `POST /api/entities/:e` | Create (201; validation errors → 422 `VALIDATION`) |
| `PATCH /api/entities/:e/:id` | Partial update (writes audit diff) |
| `DELETE /api/entities/:e/:id` | Soft delete, or `?force=true` hard delete |
| `PUT /api/entities/:e` | Replace entity definition (admin) |
| `DELETE /api/entities/:e` | Unregister definition (admin; keeps the table) |
| `POST /api/entities/validate` | Validate a definition without saving |

## List query

```
/api/entities/order?page=2&pageSize=20&sort=-createdAt,total
  &q=acme
  &select=id,orderNumber,total
  &filter=[{"field":"status","op":"eq","value":"paid"}]
  &status=paid                              ← shorthand equality
  &gte_total=100                            ← shorthand gte_total
  &where={"customer":{"name":{"contains":"acme"}}}   ← nested relation filters
```

Operators: `eq neq gt gte lt lte in nin like ilike contains startsWith endsWith
between isNull isNotNull`. Relations join automatically for filters/sorts on
`ref` fields (`customer.name`). Response: `{ data, total, page, pageSize,
pageCount }`.

## Semantics worth knowing

- **Validation** runs per operation (create requires required fields; update
  validates only sent fields); coercions (`"42"` → `42`, `"true"` → `true`)
  happen in zod.
- **Uniques** map to `409 UNIQUE_CONFLICT` (works against both live tables and
  PGlite).
- **Soft delete** hides rows from everyone; rows are visible with
  `?withDeleted=true` only when the caller may delete (RBAC).
- **Audit**: creates/updates/deletes write `{ action, changes }` diffs to
  `mosaic_audit` (disable per entity with `audit: false`).
- **Meta** (`/meta`) also exposes `endpoints` and `query` capabilities so
  generated clients can adapt.
