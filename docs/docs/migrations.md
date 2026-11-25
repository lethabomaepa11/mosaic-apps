---
sidebar_position: 6
---

# Migrations

The migration engine compares registered entity metadata with the live database
and computes a fresh plan. Review that plan against the target database before
applying it.

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
npx @mosaic-apps/cli migrate --dry-run
npx @mosaic-apps/cli migrate
```

In the Studio: **Entities → your entity → Plan migration** shows the SQL in a
modal, then **Apply migration** runs it for that entity.

The CLI dry run can sync source definitions into the registry while leaving
business tables unchanged. Use a staging database to review changes for production.

## Safety rules

- Destructive statements such as dropping a field are flagged. Both the CLI
  apply command and the API default to allowing destructive changes. To skip
  them in an API call, send `{ "allowDestructive": false }` to
  `POST /api/migrations/apply`.
- Renames are modelled as drop + add (no rename detection yet) — back up
  first, or copy data in a follow-up statement.
- Reserved-word tables (`order`, `user`…) are quoted everywhere; introspection
  normalises quoted `regclass` names.

## Defaults normalisation

Common default spellings (`now()`, `CURRENT_TIMESTAMP`, `'[]'::jsonb`,
`'active'::text`, booleans, numbers) are normalised before comparison so the
plan stays empty after a successful apply.
