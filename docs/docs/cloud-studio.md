---
sidebar_position: 3
title: Hosted Studio
---

# Hosted Studio

Mosaic Cloud is the hosted path for people who want to describe an app, edit it
visually, and optionally connect GitHub and Vercel. It uses the same Mosaic runtime
and database-first artifacts as local development; it is not a separate generated
application architecture.

## How it works

1. Type a prompt on the home page; you can do this before signing in. Your prompt is
   kept while you sign up, sign in, or continue with GitHub, then the build starts.
2. The planner may ask one short round of questions when the answer changes the data
   model. Answer, or choose **Decide for me**.
3. A developer agent designs the app (entities, relationships, pages, roles, sample
   data). A verifier runs real create, list and edit checks on a fresh Mosaic server, and
   a reviewer checks that every workflow in your brief is possible. Each agent's thinking
   appears in the chat while it works.
4. The verified app runs live in the preview pane with its own preview database. Pages
   are real Mosaic pages: tables with create, edit, delete and detail views, dashboards,
   and navigation.
5. Send changes in the chat. Theme and other settings changes apply to the preview at
   once and are then rebuilt, committed, and redeployed in the background.
6. Optionally connect your own GitHub (private repository, one commit per release),
   Neon (PostgreSQL), and Vercel (deployments) accounts in **Settings → Connections**.
   With Vercel, the preview switches to your live deployment once it is ready, and
   later page and data-model changes are published through the deployed app's API.

Every release is a normal Mosaic project, the same as `mosaic create`: one SvelteKit app
with the API at `/api` and Studio at `/studio`. Download it from **Source & delivery** or
clone it from GitHub, run `npm install` and `npm run dev`, and the generated pages and
forms are imported on first start. A public data-backed deployment needs PostgreSQL,
so Vercel deploys run once Neon is connected.

## AI models and limits

By default the agents run on Groq `gpt-oss-120b` using the operator's free tier: about
8,000 tokens per minute and 1,000 requests per day, shared by everyone. A build usually
takes 3 to 6 minutes and can wait on the rate limit; the chat says when it does. In
**Settings → AI** you can use your own ChatGPT (OpenAI API), Claude (Anthropic API) or
DeepSeek key; builds then use your provider's limits and billing. ChatGPT Plus and
Claude Pro subscriptions do not include API access, so create an API key with the
provider.

## Current limits

Generated apps cover data-driven business screens: entities, relationships, CRUD,
dashboards, roles and sample data. Custom Svelte code, external integrations, workflow
automation, and usage billing are not generated yet; see the [road to v1](./roadmap.md).

## Developer takeover

Generated apps remain normal SvelteKit repositories. Developers can edit Svelte,
server routes, registered components and endpoints, install npm packages, and use
the bundled `AGENTS.md` and Mosaic agent skill. The page/form JSON is an internal
artifact representation presented through visual and AI editing—not the expected
user interface.

Orval is optional for stable external OpenAPI services. It is useful for generating
typed clients and query hooks, but Mosaic's dynamic same-origin artifact APIs do not
depend on generated clients.
