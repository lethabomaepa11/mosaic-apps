---
title: FAQ
---

# FAQ

## Do I need Docker?

No. The CLI defaults to embedded PostgreSQL. Use a durable PostgreSQL service for production. [Deployment](./deployment.md)

## Where do my changes live?

Entity source and custom endpoints live in the repository. Published forms and pages live in the app database. Cloud Preview Studio changes are saved to the preview database. [Local and hosted workflows](./workflows.md)

## Where do I sign in?

For a Cloud deployment, reveal the initial administrator credentials in **Source & delivery** and open the deployed app's `/login`. For a local CLI scaffold, follow the framework-specific setup. [Cloud delivery](./cloud-studio.md#deliver-a-release) · [Local quickstart](./quickstart.md)

## Where do I add custom code?

Register server handlers in the application's endpoint module. Use `registerComponent` for custom Svelte artifacts in either scaffold. Next.js also supports React components in code-owned routes. [Extensions](./extensions.md)

## Can I rename a field without losing data?

Mosaic can plan a metadata rename as a drop and an add. Add the replacement field, backfill it, switch readers and writers to it, then remove the original in a later migration. [Migrations](./migrations.md)

## Can users work offline?

SvelteKit's optional PWA can serve cached assets and an offline fallback. Business records and writes need an API connection unless you implement your own persistence and synchronization. [PWA](./pwa.md)
