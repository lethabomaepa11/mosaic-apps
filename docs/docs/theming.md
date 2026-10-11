---
sidebar_position: 11
---

# Theming

`@mosaic-apps/mosaic-ui` components use Mosaic CSS variables. Import the package styles,
then override the tokens in your application:

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

The Studio Theme editor currently provides light/dark/system mode, independent
light and dark semantic colors, radius, spacing, font tokens, transition
settings, a live preview, and four presets. Theme settings are saved through
`theme.config` and applied by generated runtime layouts.

`ThemeConfig` also has fields for named palettes, but Studio does not yet expose
a complete named-theme gallery, custom theme import/export, user preference
persistence, or contrast validation. Logo upload and generated-app branding are
also pending. The CSS token bridge and current theme editor are compatible with
those planned additions.
