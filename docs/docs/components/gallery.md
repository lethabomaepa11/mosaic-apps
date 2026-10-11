---
sidebar_position: 2
---

# Component gallery

Use these examples to choose components for your application. In Studio, drag a
component from the palette, select it on the canvas, then edit its properties.
For the complete list and property reference, see the [catalog](./catalog.md).

## Forms and inputs

![Text, select, date, notes, and switch components in a customer form](/img/screenshots/input-components.png)

| Component | Use it for | Configure |
| --- | --- | --- |
| Text field | Names, email addresses, short text | Label, data binding, required, placeholder |
| Text area | Notes and descriptions | Label, binding, rows, help text |
| Number field | Prices, quantities, scores | Binding, minimum, maximum, step |
| Select / multi-select | A known list of choices | Options, binding, placeholder |
| Date picker | Calendar dates | Binding, minimum/maximum date, required |
| Checkbox / switch | Boolean preferences | Label and binding |
| File upload | Attachments | Accepted file types and binding |
| JSON editor | Structured values | Binding; values open in a Monaco modal |

Choose an entity in **Form settings** to get data-binding suggestions. You may
also enter your own binding path. Select options use a JSON array of value/label
objects; choose **Edit Options** to open the modal editor.

## Date selection

![Calendar picker open in a customer form preview](/img/screenshots/date-picker.png)

Open the calendar button to choose a date. The picker supports keyboard
navigation and date limits. Enable the time option when the field needs a date
and time. Preview the form to check the interaction before publishing.

## Layout, display, and tables

![Dashboard with heading, statistics, feedback, and a customer table](/img/screenshots/dashboard-components.png)

Use **Grid**, **Card**, **Panel**, **Tabs**, and **Accordion** to group related
content. Add **Heading**, **Stat card**, **Description list**, **Timeline**, and
**Image** to communicate context and record details. Image sources can be a URL
or an uploaded file; provide alternative text.

**Data table** displays configured rows and columns. Its columns are JSON
objects with keys and labels. **Entity table** loads business records from an
entity and provides optional create/edit/delete controls and inline detail
drill-down. Select the entity first, then choose its columns.

Feedback components include **Alert**, **Badge**, **Progress**, **Spinner**,
**Skeleton**, and **Empty state**. Use them to make loading, status, and empty
results understandable. **Chart** can display configured data series.

## Reuse a form

Add **Embedded form**, search for an existing form, and choose it. Configure
initial props in its JSON modal and bind child values to a parent object.
Use this for shared address, contact, or line-item sections. The runtime prevents
recursive inclusion; aggregate nested validation remains planned.

## Actions and custom behavior

![JavaScript and TypeScript authoring in the Execute script modal](/img/screenshots/execute-script.png)

Select a component's **Actions** tab to add messages, API calls, navigation, or
state updates. Choose **Execute script** and **Edit script** for custom code.
Monaco offers runtime `state` and `api` autocomplete. Apply the editor draft,
then save the form or page to publish it.

## Visibility and JSON configuration

![Condition authoring in a Monaco modal](/img/screenshots/condition-editor.png)

The **Logic** tab contains visibility and disabled conditions. Safe expressions
open in Monaco, and custom JavaScript/TypeScript conditions open in a script modal.

![TypeScript condition in its modal editor](/img/screenshots/condition-script.png)

![Form definition editing in a Monaco JSON modal](/img/screenshots/json-editor.png)

All editable JSON uses the same modal flow: **Edit**, change the draft, then
**Apply** or **Cancel**. Invalid JSON stays open with an error. See the
[Studio guide](../builder.md) for settings and publishing.
