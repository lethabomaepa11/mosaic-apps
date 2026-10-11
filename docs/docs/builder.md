---
sidebar_position: 9
---

# Builder guide (Studio)

Start Studio with its API from the repository root:

```bash
npm run dev
```

The launcher waits for `http://127.0.0.1:8787/api/health` before it starts
Studio at `http://localhost:4173`. This avoids proxy 502 responses while the API
is initializing. The form and page designers are at `/studio/forms/:id` and
`/studio/pages/:id`.

## Forms and pages

- The **Palette** provides 59 components. Drag fields and containers onto the
  canvas, then configure the selected node in **Properties**.
- **Layers** shows the component tree and field bindings.
- Preview is inline canvas mode with desktop, tablet, and mobile widths.
  Returning to edit keeps the designer mounted.
- Form identity, entity, layout, columns, motion, initial data source,
  submission behavior, and SEO values belong in **Form settings**.
- Page identity, route, access, application-shell layout, sidebar navigation,
  motion, SEO, and social metadata belong in **Page settings**.
- Save on a form persists and publishes its current definition.
- `Ctrl/Cmd+S` saves from anywhere in Form Studio. If edits arrive while a
  publish is in flight, Studio queues another version instead of marking those
  edits as saved.
- `EntityTable` supports configured columns, create/edit/delete, and optional
  row drill-down to its inline detail view when connected to an API client.
- Entity field suggestions assist bindings, and custom binding strings remain
  allowed.

Every component has a common **Actions** editor. Actions can show a message,
call the configured API, navigate to a searchable form/page target, update an
application/page/form/component state path, or run custom JavaScript/TypeScript.
The custom-code option opens Monaco inline and autocompletes the runtime state
and action API.

`visibleIf` and `disabledIf` use Mosaic's restricted expression interpreter by
default. Choose JavaScript/TypeScript and click **Code editor** when a condition
needs custom logic. Script conditions run in the same isolated, limited browser
sandbox as script actions. See [Runtime state management](./state-management.md).

## Embedded forms

Add **Embedded form**, search for a form, and select it. Configure JSON initial
props and a parent data binding (default `childFormData`). Nested input changes
are written to that object. The child omits submit controls and document
metadata, inherits view mode, prevents recursive inclusion, and is limited to
eight embedded levels. Nested required-field errors are not yet combined with
the parent form's validation.

## State management

`@mosaic-apps/mosaic-ui` exports `createMosaicState`, `MosaicState`, and `StateStore`.
PageRenderer owns or accepts application/page scopes. FormRenderer creates a
form scope; nested forms share application/page stores and isolate form stores.
State is instance-owned and serializable. Component actions and custom code use
the same scopes. Persistence adapters remain opt in future work. See
[Runtime state management](./state-management.md).
