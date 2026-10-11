---
sidebar_position: 1
---

# Component catalog

All 59 registry types (`getComponent(type)`), grouped by palette category.
Field components bind to form data via `binding`; containers render `children`.

## Inputs (19)

| type | renders | key props |
|---|---|---|
| `textField` | text/email/password/URL/phone/slug/money | `label, binding, required, format, placeholder, maxlength, helpText` |
| `textArea` | multi-line | `label, binding, required, rows, helpText` |
| `numberField` | number (min/max/step) | `label, binding, required, min, max, step` |
| `currencyField` | money input | `label, binding, required` |
| `selectField` | dropdown | `label, binding, required, options` |
| `multiSelect` | checkbox list | `label, binding, required, options` |
| `radioGroup` | radios | `label, binding, required, options, mode: radio` |
| `checkboxGroup` | checkboxes | `label, binding, options, mode: checkbox` |
| `switch` | toggle | `label, binding` |
| `slider` | range | `label, binding, min, max, step, showValue` |
| `datePicker` | date | `label, binding, required, min, max` |
| `timePicker` | datetime-local | `label, binding, withTime: true` |
| `colorPicker` | color + presets | `label, binding, presets` |
| `rateInput` | stars | `label, binding, count` |
| `refSelect` | live entity picker | `label, binding, entity` (loads `/options`) |
| `jsonEditor` | JSON textarea w/ validation | `label, binding, rows` |
| `fileUpload` | file → `POST /files` | `label, binding, accept` (+ `client`) |
| `searchField` | debounced search box | `placeholder, debounceMs, onSearch` |

`options` shape: `[{ "value": "a", "label": "A", "color?": "#…" }]`.
Framework props on any field: `binding, required, visibleIf, disabledIf, colSpan, helpText`.

## Data (6)

| type | renders | key props |
|---|---|---|
| `dataTable` | static table | `columns [{key,label,width?,sortable?}], rows` |
| `entityTable` | live table + search + pagination | `entity, title, columns?, pageSize, sortable, searchable` (+ `client`) |
| `subform` | nested form renderer | `formId, props, binding, mode` (+ `client`); child data is written to the parent binding |
| `pagination` | pager | `page, pageSize, total` |
| `toolbar` | action row (container) | — |
| `filterBar` | filter chips (container) | `activeCount` |

## Layout (11)

`card` (`title, subtitle, flush`), `panel` (`title, subtitle`), `tabs`
(`tabs [{id,label}]`, container, max 6), `accordion` (`items`, `multiple`,
container), `modal` (`title, size`, container), `drawer` (`title, side`,
container), `grid` (`columns 1–6, gap`, container), `stack` (`direction:
column, gap`, container), `stepper` (`steps[], current`), `emptyState`
(`icon, title, text`), `splitPane` (`initial %, direction`, container, max 2).

## Display

`image` (`src, alt, width, height, fit, href, caption`), `heading` (`text, level 1–4, muted`), `divider`, `statCard` (`label, value`
static or `entity` live count, `trend, trendDir, icon`; + `client` for live),
`statRow` (container: auto grid), `timeline` (`items [{title,text,time}]`),
`avatar` (`name, color, size`), `descriptionList` (`items [{label,value}]`),
`codeBlock` (`code`), `jsonView` (`value, collapsed`), `treeView`
(`nodes [{id,label,children?}]`), `breadcrumbs` (`items [{label,href?}]`).

## Feedback (7)

`alert` (`variant info|success|warning|danger, title, text`), `badge`/`tag`
(`text, variant, color`), `progress` (`value 0–100, variant, showLabel`),
`spinner` (`size`), `skeleton` (`lines, width`), `tooltip` (`text`).

## Navigation (3)

`button` (`label, variant primary|secondary|ghost|danger, size, block`),
`iconButton` (`label, icon: true`), `menu`
(`items [{label,icon?,danger?,separator?}], align`).

## Charts (1)

`chart` (`type bar|line|pie|donut`, `series [{name,color?,data:[{label,value}]}]`, `height, showLegend`) — dependency-free inline SVG.

## Using the registry in code

```ts
import { COMPONENTS, getComponent, createNode, paletteCategories } from '@mosaic-apps/ui';

const def = getComponent('textField');   // { component, defaults, inspector, … }
const node = createNode('grid');         // { id, type, props: defaults, children: [] }
const groups = paletteCategories();      // for a custom palette UI
```
