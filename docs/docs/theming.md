---
sidebar_position: 11
---

# Theming

Every generated app stores its global theme in the `theme.config` row of
`mosaic_settings`. The runtime loads that one JSON value from `/api/theme` and
applies it at the document root, so navigation, pages, forms, and DaisyUI
components change together. Page artifacts do not duplicate application colors.

The Studio theme picker includes the curated DaisyUI themes Corporate, Business,
Light, Dark, Nord, Winter, Silk, and Lo-fi. Choosing one sets `activeTheme` in the
database-backed configuration. Choose **Custom tokens** to override semantic
Mosaic variables instead:

```css
:root {
  --m-primary: #4f46e5;
  --m-surface: #ffffff;
  --m-bg: #f6f8fb;
  --m-fg: #16202c;
  --m-border: #dde3ec;
  --m-radius: 10px;
  --m-font: Inter, system-ui, sans-serif;
}
```

The Studio Theme editor also provides light/dark/system mode, independent light
and dark semantic colors for custom-token mode, radius, spacing, font tokens,
transition settings, a live preview, and four custom-color presets. Saving writes
the complete configuration as one audited settings update.

`ThemeConfig` also supports project-defined named palettes. Custom theme
import/export, per-end-user preference persistence, and contrast validation are
still pending. Logo upload and generated-app branding are also pending.
