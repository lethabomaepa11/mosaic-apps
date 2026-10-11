---
sidebar_position: 4
---

# CLI reference

Run commands inside your generated project with `npx mosaic <command>`.
Use `-C, --dir <path>` to target another directory, or `--help` for help.

## Create an application

```bash
npx @mosaic-apps/cli@latest create "Acme CRM"
```

| Option | Purpose |
| --- | --- |
| `--db URL` | PostgreSQL connection string; defaults to persistent embedded storage at `pglite://./data` |
| `--auth on\|off` | Enable authentication; defaults to on |
| `--demo` / `--no-demo` | Include or omit seeded example records, forms, and pages |
| `--pwa` / `--no-pwa` | Include or omit PWA support |
| `--port 3001` | API port |
| `--web-port 3000` | Frontend port |
| `--studio-port 3002` | Studio port |
| `--db-port 5433` | Docker database host port; used only when you choose external PostgreSQL |
| `--link PATH` | Explicitly use packages from a Mosaic source checkout for contributor development |
| `--no-install` | Create files and install dependencies yourself |
| `--no-git` | Create files without initializing a Git repository |

The CLI writes `.env` with a generated JWT secret. When no `--db` is supplied,
it uses embedded PostgreSQL in the project's `data/` directory. Published packages
are used by default. No Docker service is needed. See [Quickstart](./quickstart.md).

## Add an entity

```bash
npx mosaic entity Product --fields "name:string,sku:string,price:decimal,stock:int,active:boolean"
```

Field syntax is `name:type[:extra]`. The extra value names the related entity for
`ref`, or the available choices for `enum`, separated with `|`. `--soft-delete`
adds soft deletion. Review the generated entity before migrating.

## Review and apply migrations

```bash
npx mosaic migrate --dry-run
npx mosaic migrate
```

The preview shows planned SQL statements. Destructive changes require explicit
review; see [Migrations](./migrations.md).

## Start and inspect

- `npx mosaic dev`: start the project's API, web app, and Studio.
- `npx mosaic studio --port 3002`: start Studio against the project's API.
- `npx mosaic info`: inspect configuration and check API health.
- `npx mosaic seed --demo`: seed demonstration data for local exploration.

Use [Deployment](./deployment.md) when moving the application to a hosted environment.
