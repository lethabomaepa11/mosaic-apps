---
sidebar_position: 8
---

# Form JSON spec

Forms and pages are trees of **nodes**:

```json
{
  "id": "frm_abc123",
  "slug": "customer-form",
  "name": "Customer form",
  "entity": "customer",
  "version": 3,
  "published": true,
  "root": {
    "id": "c_root",
    "type": "form",
    "children": [
      { "id": "c_1", "type": "grid", "props": { "columns": 2, "gap": "md" }, "children": [
        { "id": "c_2", "type": "textField", "props": { "label": "Name", "binding": "name", "required": true, "colSpan": 2 } },
        { "id": "c_3", "type": "selectField", "props": { "label": "Status", "binding": "status", "options": [{"value":"active","label":"Active"}] } }
      ]}
    ]
  },
  "settings": { "layout": "vertical", "submitLabel": "Save", "showReset": true, "redirectAfterSubmit": "/thanks", "successMessage": "Saved!" },
  "dataSource": { "kind": "entity", "entity": "customer" }
}
```

## Node anatomy

- `id` — stable client id (`c_*`); preserved across saves, used for selection
  and DnD
- `type` — registry key (see [Component catalog](./components/catalog.md))
- `props` — component props; field nodes additionally carry framework props:
- `children` — only for `container: true` types (grid, card, tabs, accordion…)
- `meta` — free-form (designer badges, comments)

## Framework props (fields)

| prop | meaning |
|---|---|
| `binding` | `data[binding]` path (create it or the field is display-only) |
| `required`, `min/max`, `minLength/maxlength`, `pattern` | client-side validation (mirrors server zod) |
| `visibleIf` / `disabledIf` | expressions over `{ data, ctx }`, e.g. `status === "active"` |
| `colSpan` | grid columns spanned (1–4) |
| `helpText`, `placeholder` | UX copy |

## Pages

Same tree, `root.type: "page"`, plus `route` (`/dashboard`), `settings.title`,
and data components (`entityTable`, `statCard`, `chart`) that fetch through
the injected client.

## Lifecycle

Drafts save with `published: false`; **Publish** bumps `version` and snapshots
the tree into `mosaic_form_versions`. Consumers fetch by slug —
`GET /api/forms/:slug` resolves the *published* revision. The
[Builder guide](./builder.md) covers the Studio editing experience; the
[Component catalog](./components/catalog.md) lists every type and its props.
