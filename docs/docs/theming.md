---
sidebar_position: 11
---

# Theming

All `@mosaic/ui` components style through CSS custom properties (`.m-*`
classes), so white-labelling is a token swap — no component forks.

```css
:root {
  --m-primary: #4f46e5;        /* buttons, links, active states */
  --m-surface: #ffffff;
  --m-bg: #f6f8fb;
  --m-fg: #16202c;
  --m-border: #dde3ec;
  --m-radius: 10px;
  --m-font: 'Inter', system-ui, sans-serif;
}
```

Token files: `styles/theme.css` (palette, type scale, buttons, utilities),
`fields.css` (inputs), `components.css` (surfaces, tables, tabs),
`overlays.css` (modal, drawer, alerts, toasts), `misc.css` (stats, charts,
menus, split pane). Import order in `index.ts` defines the cascade; override
after import.

Dark mode: wrap in `[data-theme='dark']` and re-declare the same tokens —
components reference variables everywhere, so no per-component work is
needed.
