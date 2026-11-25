---
title: Local and hosted workflows
---

# Local and hosted workflows

Use the [CLI](./quickstart.md) when you want to start with a repository and design your own entities. Use [Mosaic Cloud](./cloud-studio.md) when you want to start with a brief, review a generated preview, and download or deliver the project.

## Where changes go

| Change | Save it in | How it takes effect |
| --- | --- | --- |
| Page or form in a local or deployed app | That app's Studio or Mosaic API | Publishing updates that app's database. |
| Page, form, or sidebar in Cloud Preview Studio | The Cloud preview | Saving updates the preview database. |
| AI-generated change in Cloud chat | A new Cloud release | Cloud builds and verifies the change before packaging and optional delivery. |
| Entity source, custom endpoint, component, or dependency | The application repository | Review schema changes, build, and deploy the code. |

A Cloud preview and a production application have separate data and credentials. If you edit live artifacts, review the next Cloud release before delivery because Cloud publishes the generated definitions to the live app. Version history is available for [published artifacts](./history.md). Use Git for source changes and database backups for production data.

## Take over an application

Download the source under **Source & delivery** or open the connected GitHub repository. Run the downloaded project locally with its own database. Add [server endpoints](./extensions.md#server-extensions) for business actions. Add Svelte components to SvelteKit or React code to Next.js for app-specific interfaces.

## Choose a deployment

[Cloud delivery](./cloud-studio.md#deliver-a-release) uses GitHub for source, Neon for PostgreSQL, and Vercel for hosting. The connections serve different purposes. For another PostgreSQL provider, a manual Git deployment, or a self-hosted server, use the [deployment guide](./deployment.md).
