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

1. Enter a brief of up to 24,000 characters on the home page. In **Options → Framework**, choose **SvelteKit**
   or **Next.js**. Cloud keeps your prompt and choice through sign-in and uses that
   framework for later releases of the same project.
2. **Feature by feature** is the default. A brief evaluator defines the users, access rules,
   data, workflows and expected outcomes. If a decision affects how the app works, Cloud
   asks in chat and refines the spec after you answer. Use **Decide for me** to delegate
   open product decisions. Scope reductions for unsupported requirements need an explicit answer.
3. A separate planner creates an ordered feature plan with acceptance checks. Open
   **Blueprint** to see the specification and build order. Cloud builds each feature,
   runs database create, list and edit checks, and reviews the result against its acceptance
   criteria. The first passing feature appears in **Preview** while Cloud works through
   later features. The final review uses the complete agreed spec. Cloud packages the
   release and queues connected providers after all features pass. Choose **One shot**
   when you want to build and preview the complete app in one pass after brief refinement.
4. Open **App**, **Sign in**, or **Open Studio** in the preview toolbar. In Preview
   Studio, open a page or form and choose **Edit** to use the visual designer. Saves
   apply to the preview database. On installations with persistent previews, they
   survive instance restarts.
   Use **Edit sidebar** from Preview or the designer toolbar. Select a link on the
   sidebar canvas to change its label, path, icon, or section, and use **Move up**
   or **Move down** to reorder it. Save to apply it across the preview. Edit the live
   sidebar separately in SvelteKit Studio under **Settings → Navigation** or in
   Next.js Page Studio using **Edit sidebar**.
   Under **Appearance**, set padding or margin for all sides, or override each side
   individually. Select **Page root** to control spacing around the whole page.
   When a SvelteKit deployment is ready, **Open live Studio** edits the deployed
   app. **Live app** opens the deployed site separately.
5. Send feedback in the chat while reviewing a preview. Cloud queues it as a change
   after the staged build. For released apps, settings changes apply to the preview
   and are rebuilt, committed and redeployed in the background.
6. Optionally connect your own GitHub (private repository, one commit per release),
   Neon (PostgreSQL), and Vercel (deployments) accounts in **Settings → Connections**.
   Cloud can deliver an existing build after you connect your accounts. Open
   **Source & delivery → Deliver latest** to queue it.
7. Cloud creates the GitHub repository, provisions a Neon database, and deploys to
   Vercel using the framework you selected. Open the production URL after delivery
   completes. Workspace owners and admins see **View admin sign-in** in the build feed.
   Open it and select **Reveal initial app sign-in** to copy the deployed app's initial
   email and password. Local downloads default to `admin@mosaic.local` and
   `admin1234` unless you set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before initial startup.

Describe who signs in and what they should do. For a book club, ask for a reading
schedule with upcoming meetings, an RSVP action, and a screen for choosing the next
book. Cloud can combine live records, counts, instructions, and working forms in
task-oriented screens along with record management pages.

If users should create their own accounts, request public sign-up in the brief or
turn on **Allow public sign-up** under the project's **Settings**. After the next
release, **Create an account** on the sign-in page opens `/signup`. New accounts
get the viewer role and can use the actions their entity permissions allow.
For a staff-only app, keep public sign-up closed.

Sign in and Create an account are published page definitions with editable titles,
copy, field labels and order, and button labels. Use **Preview Studio** to edit
the preview pages. In the deployed app, use the visual Studio on SvelteKit or
**Page Studio** on Next.js to edit and publish page JSON. The app itself processes
credentials through its auth API.

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

## Remove a project

In **Project Settings → Delete project**, type the project name to confirm. By
default, Cloud removes its project, preview, chat and releases and keeps the
resources in your own provider accounts. To delete those too, select each attached
GitHub repository, Vercel project, or Neon project you want removed. Removing the
Neon project deletes its databases and branches.

Cloud keeps the project visible if a selected provider rejects deletion. Check its
Activity, update the connection if needed, and retry. A GitHub credential needs
repository admin access and the `delete_repo` scope or fine-grained repository
Administration write permission. [GitHub repository deletion permissions](https://docs.github.com/en/rest/repos/repos#delete-a-repository)

## AI models and limits

The shared defaults route builds across Groq's GPT-OSS models. An operator can
configure Gemini as a shared backup. In **Settings → AI**, you can also select
Gemini, the OpenAI API, Anthropic or DeepSeek with your own key. If a Gemini model
is temporarily unavailable, Cloud tries another Flash-Lite model using the same
key. The build feed shows which model responded.

## Current limits

Generated apps cover data-driven business screens with entities, relationships, CRUD,
dashboards, entity-level permissions and sample data. Requirements such as tenant
isolation, per-record permissions, atomic approval and balance updates, invitation
emails and password recovery need developer implementation in the generated repository.
Database CRUD checks and AI review cover generated artifacts. See the [road to v1](./roadmap.md).

## Developer takeover

Generated apps are conventional SvelteKit or Next.js repositories. Developers can
edit application routes, components and endpoints directly. Author published
artifacts through Studio in SvelteKit or the Mosaic API in either framework.

Orval is optional for stable external OpenAPI services. It is useful for generating
typed clients and query hooks, but Mosaic's dynamic same-origin artifact APIs do not
depend on generated clients.
