---
sidebar_position: 9
---

# Builder guide (Studio)

Start your generated application from its project root:

```bash
npm run dev
```

Open Studio at `http://localhost:3002` and sign in. The web app uses port 3000
and the API uses 3001. Open **Forms** or **Pages** to create or edit a definition.

![Customer form in Studio](/img/screenshots/form-studio.png)

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
Choose **Execute script**, then **Edit script** to open Monaco in a modal with
JavaScript/TypeScript selection and runtime state/API autocomplete. **Apply script**
adds the changes to the designer; **Cancel**, Escape, or closing the modal discards
them. Save the form or page to publish the applied script.

`visibleIf` and `disabledIf` use Mosaic's restricted expression interpreter by
default. Choose JavaScript/TypeScript to open its modal editor when a condition
needs custom logic. Script conditions run in the same isolated, limited browser
sandbox as script actions. See [Runtime state management](./state-management.md).

## Code and JSON editors

Every code or JSON field opens Monaco in a modal. This includes component
options and props, static form records, API request bodies, state values,
conditions, code blocks, role permissions, settings, and form/page definitions.
Use **Apply** to update the field or **Cancel** to discard the editor draft.
Invalid JSON shows an error and stays open until corrected. API responses and
migration SQL open in read-only Monaco modals.

![JSON editing in a Monaco modal](/img/screenshots/json-editor.png)

![Execute script in a Monaco modal](/img/screenshots/execute-script.png)

## Form and page settings

Select **Form settings** for the form's identity, entity, layout, data source,
submission behavior, and search/social metadata. Return to the canvas after
editing, then **Save** to publish the complete definition.

![Form settings](/img/screenshots/form-settings.png)

**Page settings** follows the same pattern, with route, layout, navigation,
access, and metadata options. See the [roadmap](./roadmap.md) for current limits
on data-source loading and page access enforcement.

![Page settings](/img/screenshots/page-settings.png)

## Embedded forms

Add **Embedded form**, search for a form, and select it. Configure JSON initial
props and a parent data binding (default `childFormData`). Nested input changes
are written to that object. The child omits submit controls and document
metadata, inherits view mode, prevents recursive inclusion, and is limited to
eight embedded levels. Nested required-field errors are not yet combined with
the parent form's validation.

## State management

`@mosaic-apps/ui` exports `createMosaicState`, `MosaicState`, and `StateStore`.
PageRenderer owns or accepts application/page scopes. FormRenderer creates a
form scope; nested forms share application/page stores and isolate form stores.
State is instance-owned and serializable. Component actions and custom code use
the same scopes. Persistence adapters remain opt in future work. See
[Runtime state management](./state-management.md).
