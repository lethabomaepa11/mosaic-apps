---
title: Visual Studio
---

# Design pages and forms

Open `/studio` in a SvelteKit or Next.js scaffold with permission to manage pages or forms. In Cloud, open **Preview → Open Studio** for the selected project. Both published runtimes use the framework renderer and each scaffold shares its component registrations with Studio. [Mosaic Cloud](./cloud-studio.md#edit-the-preview)

![Customer form in SvelteKit Studio](/img/screenshots/form-studio.png)

## Use the canvas

1. Open **Forms** or **Pages** and choose a definition.
2. Drag components from **Palette**. Select one in the canvas or **Layers** and edit its **Properties**.
3. Set field bindings to the names your entity or endpoint expects.
4. Try the current draft with **Preview**. Select **Save** to publish it to the app database.

Use **Appearance** to set spacing and typography where supported by your UI version. For whole-page spacing, select **Page root**. Edit global navigation separately in Studio **Settings → Navigation**, or use **Edit sidebar** in Cloud Preview Studio.

## Form and page settings

| Settings | What to configure |
| --- | --- |
| Form | Entity, layout, submission behavior, and metadata. Check the runtime's support before relying on a non-entity data source. |
| Page | Route, access, navigation, layout, and metadata. A route can have parameters such as `/orders/:id`. |

A published entity form can be opened at `/f/<slug>`. Use an authenticated [server endpoint](./extensions.md#server-extensions) for sensitive business actions and server-managed fields.

## Events and logic

Use **Events** on supported components to connect button clicks, field changes, and table row clicks to actions. An action can call the Mosaic API, navigate, show a message, change state, or run a sandboxed script. **Logic** controls visibility and disabled state. Server permissions still apply. [Runtime state and actions](./state-management.md)

Code and JSON editors open in modals. **Apply** updates the designer. **Save** publishes the definition.

## Embedded forms

Add **Embedded form** and select an existing child form. Set its initial props and parent binding to reuse a group of fields. The child writes values back under that binding. The renderer prevents recursive embedding and limits nesting to eight levels. Validate the complete request on the server. [Form JSON](./form-json.md#embedded-forms)
