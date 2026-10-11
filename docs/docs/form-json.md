---
sidebar_position: 8
---

# Form JSON spec

Forms and pages are serializable trees of component nodes:

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
  "settings": { "layout": "vertical", "submitLabel": "Save", "showReset": true },
  "dataSource": { "kind": "entity", "entity": "customer" }
}
```

## Node anatomy

- `id`: stable client id preserved across saves and used by selection and DnD.
- `type`: component registry key (see [Component catalog](./components/catalog.md)).
- `props`: serializable component settings. Field nodes also use framework props.
- `children`: child nodes for container components.
- `meta`: optional designer notes and flags.

Framework props include `visibleIf`, `disabledIf`, and ordered `actions`.
Field props also include `binding`, `required`, `colSpan`, `helpText`, and
validation constraints. Bindings are strings and can
be custom; Studio suggests entity columns but does not require a catalog match.
Conditions may be a restricted Mosaic expression string or an isolated script:

```json
{
  "visibleIf": {
    "kind": "script",
    "language": "typescript",
    "source": "return state.form.status === 'ready';"
  }
}
```

Script actions use `type: "script"` and return an array of supported actions.
They execute in the browser worker sandbox described in
[Runtime state](./state-management.md).

## Embedded forms

An embedded form is a regular component node. For example:

```json
{
  "id": "c_address",
  "type": "subform",
  "props": {
    "formId": "frm_address",
    "binding": "address",
    "props": { "country": "ZA" },
    "mode": "create"
  }
}
```

The child record is merged over the configured initial props and changes are
written at the parent binding. Nested forms omit submit controls and head
metadata, inherit view mode, reject cycles, and stop at eight levels. Parent
submission does not yet collect nested required-field validation errors.

## Pages and lifecycle

Pages use `root.type: "page"`, a route, settings, and the same component tree.
Page data components receive the configured API client.

In Studio, **Save** updates and publishes a form or page in one database
transaction. The loaded version is sent with the request, so a stale tab gets a
409 conflict instead of overwriting newer work. Unchanged publication is
idempotent. Preview renders the current local tree inline. Form settings contain
submission and SEO options. Page settings contain route, access, navigation,
layout, motion, SEO, and social options. See the [Builder guide](./builder.md) for Studio
behavior and [Runtime state](./state-management.md) for actions.
