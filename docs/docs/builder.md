---
sidebar_position: 9
---

# Builder guide (Studio)

The Studio (`mosaic studio`, default http://localhost:4173) edits the same
JSON your apps render. Design at `/design/forms/:id` and `/design/pages/:id`.

## Layout

- **Palette** (left) — 57 types grouped by category; drag onto any container
- **Canvas** (center) — live render; click selects, drag reorders; drop zones
  show insertion hints; nodes have duplicate/delete handles
- **Properties** (right) — controls generated from each type's registry
  descriptor (text, number, switch, select, color, JSON)
- **Layers** (right, below) — tree with `binding` badges for data fields

Keyboard: `Ctrl/⌘+Z` undo, `Ctrl/⌘+Shift+Z` redo (60 snapshots).

## Editing flow

1. Drop components; containers (grid, card, tabs, accordion, modal, drawer,
   split pane…) accept children — nest freely.
2. Select a field → set its **binding** (e.g. `email`) so it reads/writes form
   data; use **visibleIf** for conditional fields.
3. **Preview** renders the form for real (validation + submit work).
4. **`{ }` JSON** shows the tree; paste edited JSON back with *Apply to canvas*.
5. **Save** → draft; **Publish** → new version + snapshot, served at
   `/f/<slug>` or `/p/<slug>` in generated apps.

## Data pages

- **Entities** — field editor (types, required/unique/indexed, enum options,
  ref targets), save, **Plan migration** (SQL preview modal) → **Apply**,
  plus a live **data browser** (search, sort, paginate; click a row to edit in
  an auto-generated `EntityForm`).
- **Migrations** — global pending plan + full checksum history.
- **API explorer** — pick an entity, method and path, send, inspect JSON.
- **Settings** — users/roles, reference lists, settings KV, audit log.

## Tips

- Bind the form header **entity** input to drive submit targets and ref
  pickers (`RefSelect`) automatically.
- Reuse option lists via **reference lists** instead of hard-coding options.
- Grid `colSpan` on fields + `columns: 2` grids make dense data-entry layouts.
