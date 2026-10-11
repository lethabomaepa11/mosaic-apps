---
sidebar_position: 6
---

# Migrations

The migration engine diffs **entity metadata** against the **live database**
(`information_schema` + `pg_catalog`), so there are no migration files to
write or drift to debug: the plan is always computed fresh.

## The 3-phase plan

1. **Structure** — `CREATE TABLE` for missing tables; `ADD COLUMN`,
   `ALTER COLUMN TYPE … USING`, `SET/DROP DEFAULT`, `SET/DROP NOT NULL`.
   Every statement carries a `risk` (`safe` | `destructive`).
2. **Drops** — columns absent from metadata are dropped **only if previously
   known** (`mosaic_entity_columns` allow-list); otherwise the engine emits a
   warning and leaves the column alone.
3. **Constraints & indexes** — uniques, enum CHECKs, FKs (skipped with a
   warning when the target table doesn't exist yet), indexes.

`computePlan` → review → `applyPlan({ allowDestructive })`. Each applied
table records `{ entity, version, checksum, statements, status }` in
`mosaic_migrations`; history is queryable at `GET /api/migrations`.

## Workflow

```bash
mosaic migrate --dry-run   # print SQL, apply nothing
mosaic migrate             # apply pending statements
```

In the Studio: **Entities → your entity → Plan migration** shows the SQL in a
modal, then **Apply migration** runs it for that entity.

## Safety rules

- Destructive statements (`DROP`, type changes, `SET NOT NULL`) are flagged
  and need `allowDestructive` — the CLI defaults it on, the API route takes
  `{ allowDestructive }` explicitly.
- Renames are modelled as drop + add (no rename detection yet) — back up
  first, or copy data in a follow-up statement.
- Reserved-word tables (`order`, `user`…) are quoted everywhere; introspection
  normalises quoted `regclass` names.

## Defaults normalisation

Common default spellings (`now()`, `CURRENT_TIMESTAMP`, `'[]'::jsonb`,
`'active'::text`, booleans, numbers) are normalised before comparison so the
plan stays empty after a successful apply.
