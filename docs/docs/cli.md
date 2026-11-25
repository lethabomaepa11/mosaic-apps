---
sidebar_position: 4
---

# CLI reference

Run commands inside your generated project with `npx @mosaic-apps/cli <command>`.
Use `-C, --dir <path>` to target another directory, or `--help` for help.

## Create an application

```bash
npx @mosaic-apps/cli@latest create "Acme CRM"
npx @mosaic-apps/cli@latest create "Acme CRM" --framework nextjs
```

| Option | Purpose |
| --- | --- |
| `--framework sveltekit\|nextjs` | Select the framework. Defaults to SvelteKit. |
| `--db URL` | PostgreSQL connection string; defaults to persistent embedded storage at `pglite://./data` |
| `--auth on\|off` | Enable authentication; defaults to on |
| `--demo` / `--no-demo` | Include or omit seeded example records, forms, and pages |
| `--pwa` / `--no-pwa` | Include or omit PWA support |
| `--port 3001` | Legacy separate-API port retained for older projects |
| `--web-port 3000` | Port for the app, its API, and Studio (`/studio`) |
| `--db-port 5432` | Host port for the generated Docker PostgreSQL service |
| `--link PATH` | Explicitly use packages from a Mosaic source checkout for contributor development |
| `--no-install` | Create files and install dependencies yourself |
| `--no-git` | Create files without initializing a Git repository |

The CLI writes `.env` with a generated JWT secret. When no `--db` is supplied,
it uses embedded PostgreSQL in the project's `data/` directory. Published packages
are used by default. No Docker service is needed. See [Quickstart](./quickstart.md).
If your project has a separate `apps/studio` workspace, see the
[unified Studio upgrade guide](./deployment-studio.md#upgrade-from-a-separate-studio-app).

## Add an entity

```bash
npx @mosaic-apps/cli entity Product --fields "name:string,sku:string,price:decimal,stock:int,active:boolean"
```

Field syntax is `name:type[:extra]`. The extra value names the related entity for
`ref`, or the available choices for `enum`, separated with `|`. `--soft-delete`
adds soft deletion. Review the generated entity before migrating.

## Review and apply migrations

```bash
npx @mosaic-apps/cli migrate --dry-run
npx @mosaic-apps/cli migrate
```

The preview prints planned SQL. The apply command can run destructive statements,
so review the preview before applying. [Migrations](./migrations.md)

## Start and inspect

- `npx @mosaic-apps/cli dev` starts the app and its same-origin API.
- `npx @mosaic-apps/cli studio` starts the app and prints its Studio URL.
- `npx @mosaic-apps/cli info` prints project configuration and API health.
- `npx @mosaic-apps/cli seed --demo` adds demonstration data for local exploration.

Use [Deployment](./deployment.md) when moving the application to a hosted environment.
