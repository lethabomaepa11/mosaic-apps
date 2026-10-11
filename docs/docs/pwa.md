---
sidebar_position: 10
---

# PWA guide

Every generated web app is an **installable PWA**: manifest, service worker,
icons and an offline page ship in the template.

## What ships

- `static/manifest.webmanifest` — name, colors, `standalone` display, 192/512
  + maskable icons
- `static/sw.js` — shell precache (`/`, offline page, icons, manifest);
  **network-first** for `/api` + `/files` with stale fallback (offline reads
  keep working); navigation fallback to `/offline.html`
- `static/offline.html` — friendly offline page
- `scripts/make-icons.mjs` — generates real PNG icons (no binary assets in
  the template); run via `npm run icons`
- layout registers `/sw.js` on first load

## Offline forms

Published form trees are JSON: once visited, the page shell + form definition
are cached, so data entry keeps rendering offline. Queueing submits for
background sync is app-specific — a typical pattern:

1. `try { await client.createRecord(...) } catch (offline) { save to
   localStorage queue }`
2. On `online` event or SW `sync`, replay the queue.

## Installability checklist

- Served over HTTPS (or localhost) ✓
- 192px + 512px icons ✓ (generated)
- `start_url`, `display: standalone`, `theme_color` ✓
- Service worker with `fetch` handler ✓

Test with Chrome DevTools → Application → Manifest, and Lighthouse PWA
audits. Bump the `VERSION` constant in `sw.js` when you change caching
strategy — old caches are purged on activate.
