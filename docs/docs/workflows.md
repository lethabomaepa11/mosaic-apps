---
sidebar_position: 3
---

# Local and hosted workflows

Mosaic has two entry points that produce the same portable application: a local
developer project and hosted Mosaic Studio.

## Local development

```bash
npx @mosaic-apps/cli create my-app
cd my-app
npm run dev
```

PGlite supplies durable embedded PostgreSQL locally. Pages, forms, navigation,
theme, and entity definitions are edited through Studio and stored in the database;
every business entity has its own physical table. Users work visually rather than
editing JSON.

Developers can add ordinary Svelte routes and components, Hono server commands, and
npm dependencies. Registered custom components appear in the builder. Visual
artifact changes publish without rebuilding; source, dependency, and schema changes
go through checks, migration review, build, and deployment.

## Hosted Studio

Describe an application or choose a template. Mosaic creates a private workspace,
preview database, homepage, login, application shell, entities, forms, and routes.
Continue through chat, direct canvas editing, Data, and Logic views.

| Connections | Outcome |
| --- | --- |
| Neither | Hosted preview and source download |
| GitHub only | Repository and source history |
| Vercel only | Direct preview and production deployments |
| Both | Repository-backed continuous deployment |

A public data-backed deployment also needs PostgreSQL. Mosaic can provision Neon,
connect Supabase, or use an existing PostgreSQL connection.

## Application history

Studio autosaves drafts. Save creates an immutable revision with an author, message,
parent, checksum, and snapshot. Publish selects a committed revision. Restore creates
a new forward revision rather than deleting history. Visual users see semantic and
canvas differences; developers can inspect structural diffs or export a release.

## Developer takeover

Generated projects use standard SvelteKit, TypeScript, Hono, PostgreSQL, npm, and
Git. They include local agent instructions describing safe Mosaic extension points.
Developers can work without hosted Studio and can embed database pages/forms by name
inside custom Svelte.

## Deployment

The target deployment is one Vercel project containing SvelteKit pages and Mosaic
API functions. Neon is the default automated database provider; Supabase and generic
PostgreSQL are supported. Hosted Studio is a separate control plane and does not own
customer business records.

The active [platform plan](https://github.com/lethabomaepa11/mosaic-apps/blob/main/contributor-docs/platform-plan.md)
contains the complete specification, delivery tasks, and acceptance criteria.
