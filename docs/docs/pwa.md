---
sidebar_position: 10
---

# Install your application

SvelteKit's optional PWA scaffold includes a web manifest, service worker,
icons, and an offline fallback. Create the app with `--pwa`, deploy over HTTPS,
and use your browser's install action.

## What is cached

The service worker caches the application shell and static assets. Business API
responses and uploaded files use the network and are not stored in the shared
service-worker cache. Previously cached data is removed when the new cache
version activates.

Cached navigation and assets can help display an offline fallback. Published
form definitions and business records still need API access; complete offline
record editing and automatic submission synchronization are not implemented.

## If your workflow needs offline editing

Design an explicit, user-scoped persistence layer with logout cleanup, expiry,
data minimization, queued write identifiers, retry handling, and conflict
resolution. Decide which records may be stored on the device. Do not put bearer
tokens or private records in a shared cache.

## Configure and inspect

- Edit `static/manifest.webmanifest` for the app name, colors, and start URL.
- Generate icons with `npm run icons` in `apps/web`.
- Inspect the manifest and service worker in your browser's Application tools.
- Increment the service worker's cache version when changing cached assets.

See [Deployment](./deployment.md) for supported frontend hosting options.
