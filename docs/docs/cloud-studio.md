---
sidebar_position: 3
title: Hosted Studio
---

# Hosted Studio

Mosaic Cloud is the hosted path for people who want to describe an app, edit it
visually, and optionally connect GitHub and Vercel. It uses the same Mosaic runtime
and database-first artifacts as local development; it is not a separate generated
application architecture.

## Intended workflow

1. Sign in and describe a business or passion app. Groq converts the brief into a
   structured blueprint with routes, business tables, roles, and workflows.
2. Choose the app framework, UI system, clean starting theme, and whether the
   initial app includes `/` and `/login`. Theme tokens remain editable after
   generation.
3. Continue through chat, Build, Data, Logic, Preview, and Deploy views.
4. Mosaic runs source and dependency changes in an isolated workspace and exposes a
   live preview. Artifact-only page and form edits can publish without rebuilding.
5. Optionally connect GitHub to create and push a developer-owned repository.
6. Optionally connect Vercel for preview and production deployments.
7. Use Neon by default, or connect Supabase or another PostgreSQL service.

GitHub and Vercel are optional. A user can download verified source without either
connection. A public data-backed app still needs a durable PostgreSQL database.

## Current implementation

The first hosted slice now implements authentication, organizations and
memberships, projects, default page choices, conversation history, preview and
production environment records, durable job records, provider-connection records,
and an audit log. The Cloud shell uses a deliberately limited DaisyUI theme set so
users can choose Corporate, Business, Light, Dark, Nord, Winter, Silk, or Lo-fi
without introducing novelty themes into the default business-app workflow.
Framework, UI system, and theme are separate project
properties. SvelteKit is the supported runtime adapter today; additional adapters
stay unavailable in the UI until generation, preview, and deployment support is
complete. Creating a project asks Groq for a strict, typed application blueprint,
stores it in PostgreSQL, and then queues a generation job with that blueprint.

Project design settings are editable later and remain in PostgreSQL. The global
theme maps to the generated app's single `mosaic_settings.theme.config` record,
which the runtime applies at the document root. The Cloud shell itself stays on
the consistent Corporate theme and never changes with project output.

The worker that consumes that job, isolated previews, encrypted provider secret
operations, GitHub/Vercel authorization, automatic database provisioning, usage,
and billing remain visible tasks in the
[platform plan](https://github.com/mosaic-apps/mosaic-apps/blob/main/contributor-docs/platform-plan.md).

## Developer takeover

Generated apps remain normal SvelteKit repositories. Developers can edit Svelte,
server routes, registered components and endpoints, install npm packages, and use
the bundled `AGENTS.md` and Mosaic agent skill. The page/form JSON is an internal
artifact representation presented through visual and AI editing—not the expected
user interface.

Orval is optional for stable external OpenAPI services. It is useful for generating
typed clients and query hooks, but Mosaic's dynamic same-origin artifact APIs do not
depend on generated clients.
