---
sidebar_position: 15
---

# Recipes

## Approval dashboard page

1. Studio → Pages → Create "Approvals".
2. Drop a `statRow` with three `statCard`s (`entity: order`, trends).
3. Drop an `entityTable` (`entity: order`, columns `["orderNumber","status","total"]`).
4. Add a `menu` with an "Approve" item — wire `onclick` later, or open the
   record via `onrowclick` into an `EntityForm` modal.
5. Publish → `/p/approvals`.

## Conditional field

On a field's `visibleIf`: `status === "active" && total > 1000`. Expressions
evaluate against `{ data, ctx }` with the core interpreter (no `eval`).

## Enum from a reference list

Instead of hard-coding options, keep statuses in **Settings → Reference
lists** and consume via API in custom components (`GET /api/ref-lists/:name`).

## Seeding per-environment data

Keep `SEED=false` in prod; run `mosaic seed` once after first deploy, then
manage users in **Settings → Users**. Demo content (`--demo`) is for local
dev only.

## Multi-tenant-ish scoping (simple)

Add an `org` ref field to entities, gate `permissions.create/update` to
`admin,editor`, and filter lists with `?filter=[{"field":"org","op":"eq",
"value":"<id>"}]` in a custom page scope. (Native tenancy is roadmap.)
