---
sidebar_position: 3
title: Mosaic Cloud
---

# Mosaic Cloud

[Open Mosaic Cloud](https://cloud.mosaictalent.co.za)

Mosaic Cloud is the hosted path for people who want to describe an app, edit it
visually, and deliver it through GitHub, Neon and Vercel. SvelteKit and Next.js
projects use the same Mosaic runtime and database-first artifacts.

## How it works

1. Type a prompt on the home page. In **Options → Framework**, choose **SvelteKit**
   or **Next.js**. Cloud keeps your prompt and choice through sign-in and uses that
   framework for later releases of the same project.
2. The planner may ask one short round of questions when the answer changes the data
   model. Answer, or choose **Decide for me**.
3. A developer agent designs the app (entities, relationships, pages, roles, sample
   data). A verifier runs real create, list and edit checks on a fresh Mosaic server, and
   a reviewer checks that every workflow in your brief is possible. Each agent's thinking
   appears in the chat while it works.
4. Open **App**, **Sign in**, or **Open Studio** in the preview toolbar. In Preview
   Studio, open a page or form and choose **Edit** to use the visual designer. Saves
   apply to the preview database, which can reset on a hosted instance restart.
   When a SvelteKit deployment is ready, **Open live Studio** edits the deployed
   app. **Live app** opens the deployed site separately.
5. Send changes in the chat. Theme and other settings changes apply to the preview at
   once and are then rebuilt, committed, and redeployed in the background.
6. Optionally connect your own GitHub (private repository, one commit per release),
   Neon (PostgreSQL), and Vercel (deployments) accounts in **Settings → Connections**.
   Cloud can deliver an existing build after you connect your accounts. Open
   **Source & delivery → Deliver latest** to queue it.
7. Cloud creates the GitHub repository, provisions a Neon database, and deploys to
   Vercel using the framework you selected. Open the production URL after delivery
   completes. Workspace owners and admins can use **Source & delivery → Reveal
   initial app sign-in** to see the deployed app's first admin credentials.

Describe who signs in and what they should do. For a book club, ask for a reading
schedule with upcoming meetings, an RSVP action, and a screen for choosing the next
book. Cloud can combine live records, counts, instructions, and working forms in
task-oriented screens along with record management pages.

If users should create their own accounts, request public sign-up in the brief or
in a change. The generated app shows **Create an account** on its sign-in page.
New accounts get the viewer role and can use the actions their entity permissions
allow. For a staff-only app, describe who should manage accounts.

**Source & delivery** also lets you download the app. Install dependencies and run
`npm run dev` from the repository root. The generated pages and forms import on
first start. Next.js downloads include a lockfile, so use `npm ci`. Both frameworks
serve the Mosaic API at `/api`. SvelteKit includes Studio at `/studio`. Next.js uses
React to render published pages and forms. The private Cloud preview uses Mosaic's
shared renderer and sample database for both frameworks.

If Vercel rejects an expired or revoked credential, open **Settings → Connections**
and choose **Reconnect Vercel** or replace the access token in place. Cloud keeps
your session, repository and deployment settings, then resumes the latest blocked
delivery. Vercel's integration credential uses a fresh authorization when revoked.

## AI models and limits

The shared defaults route builds across Groq's GPT-OSS models. An operator can
configure Gemini as a shared backup. In **Settings → AI**, you can also select
Gemini, the OpenAI API, Anthropic or DeepSeek with your own key. If a Gemini model
is temporarily unavailable, Cloud tries another Flash-Lite model using the same
key. The build feed shows which model responded.

## Current limits

Generated apps cover data-driven business screens: entities, relationships, CRUD,
dashboards, roles and sample data. Custom Svelte code, external integrations, workflow
automation, and usage billing are not generated yet; see the [road to v1](./roadmap.md).

## Developer takeover

Generated apps are conventional SvelteKit or Next.js repositories. Developers can
edit application routes, components and endpoints directly. Author published
artifacts through Studio in SvelteKit or the Mosaic API in either framework.

Orval is optional for stable external OpenAPI services. It is useful for generating
typed clients and query hooks, but Mosaic's dynamic same-origin artifact APIs do not
depend on generated clients.
