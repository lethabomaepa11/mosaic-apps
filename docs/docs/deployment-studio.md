---
sidebar_position: 13
---

# Studio and hosted building

Generated repositories include Studio in the app itself at `/studio`. `npm run dev`
starts one server for the app, `/api`, and Studio, and the same deployment serves
all three. Studio requires an administrator or editor account.

## Local authoring

```bash
npm run dev
```

The default topology is:

| Service | URL |
| --- | --- |
| Application and API | `http://localhost:3000` |
| Studio | `http://localhost:3000/studio` |

Change the port with `MOSAIC_WEB_PORT`. Page, form, and
entity definitions are database-first. Source routes, custom components,
dependencies, and entity classes remain repository-owned.

## Hosted Mosaic Studio

The future hosted Studio is a control plane that creates isolated workspaces,
previews changes, and optionally connects GitHub, Vercel, Neon, or an existing
PostgreSQL database. A successful hosted flow produces the same portable generated
repository as the CLI flow.

Provider connections must use OAuth or scoped tokens, encrypted secret storage,
revocation, and audit logs. Builds and arbitrary package installation run in
isolated workers, never inside the long-lived Studio web process.

GitHub and Vercel are optional: without GitHub the source remains downloadable;
without Vercel the workspace still produces a verified build and deployment
instructions. A public data-backed app always requires durable PostgreSQL.
