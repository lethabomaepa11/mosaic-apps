# Mosaic

Metadata-driven full-stack platform for TypeScript: **entity → migration → auto CRUD →
drag & drop forms/pages**, shipped as a rich CLI and an installable PWA.

Define your domain once — as a TypeScript class or a JSON file — and Mosaic creates the
Postgres table, the REST API, validation, RBAC, audit trail and the UI scaffolding.
Then compose UIs visually in the Studio and publish them as routes in your web app.

```
@mosaic-apps/core   entity/form/page metadata, expression engine, decorators
@mosaic-apps/server Hono API: registry, migration engine, auto CRUD, auth, files, audit
@mosaic-apps/cli    mosaic create / entity / migrate / seed / studio / dev
@mosaic-apps/ui     50+ Svelte components + drag & drop primitives (consumed as source)
```

## Repository layout

| path | what it is |
|---|---|
| `packages/` | `core`, `server`, `cli`, `ui` |
| `apps/studio` | the visual designer (forms, pages, entities, migrations) |
| `templates/fullstack` | the project `mosaic create` scaffolds from |
| `docs/` | Docusaurus site (`npm run docs:start`) |
| `infra/` | `docker compose` Postgres (`npm run db:up`) |
| `scripts/` | e2e runner + `link-cli.mjs` |

## Requirements

Application usage is documented in the public [guides](docs/docs/intro.md).
Repository setup, architectural decisions, and release procedures are in
[contributor documentation](contributor-docs/README.md).

- Node.js 22+ (26 tested)
- npm 11+
- Docker (optional) for Postgres — `DATABASE_URL=pglite://memory` runs on embedded
  Postgres with no external database at all

## Develop the platform

```bash
npm install          # once
npm run build        # build all packages (needed before file: linking)
npm test             # core + server unit tests
npm run typecheck    # all packages + studio
npm run e2e          # boot the API on PGlite and exercise it over HTTP
npm run dev           # API (:3001) + Studio (:3000), with the API proxy available
npm run dev:api      # API on :3001 (PGlite)
npm run dev:studio   # designer on :3000
npm run db:up        # Postgres 16 on :5432
```

## Create an app from this checkout (no npm publish needed)

The CLI resolves the template and the `@mosaic/*` packages from this repo, so you can
scaffold real apps before anything is published:

```bash
# 1. run the CLI from source (no build, no install)
npm run create -- my-app                       # == npm run mosaic -- create my-app
npm run create -- my-app --no-git --no-install --port 8901 --web-port 5610

# 2. or build + link the `mosaic` bin globally, then use it anywhere
npm run link-cli
mosaic create my-app --link C:/path/to/mosaic-apps

# 3. published mode later on: --npm-mode uses registry versions instead of file: links
```

Useful `create` flags: `--db <url>`, `--auth on|off`, `--demo/--no-demo`,
`--pwa/--no-pwa`, `--port`, `--web-port`, `--db-port`, `--pm`, `--install/--no-install`,
`--git/--no-git`, `--link <repo>`, `--force`.

Inside a generated app:

```bash
docker compose up -d      # or any Postgres pointed at by DATABASE_URL
npm run dev               # API + web together (scripts/dev.mjs)
npm run migrate           # plan (preview) + apply schema changes
mosaic entity Order --fields "total:decimal,customer:ref:customer" --soft-delete
```

## Entities as classes

Entity classes live in `apps/api/src/entities/*.entity.ts` and are synced into the
registry at boot — edit, restart, `npm run migrate`:

```ts
import { Entity, Field, Relation } from '@mosaic-apps/core';

@Entity({
  name: 'customer',
  label: 'Customer',
  icon: 'building',
  softDelete: true,
  list: { defaultSort: '-createdAt', labelField: 'name' },
  permissions: { read: ['*'], create: ['admin', 'sales'], delete: ['admin'] },
})
export class Customer {
  @Field({ type: 'string', required: true, searchable: true, maxLength: 160 })
  name!: string;

  @Field({ type: 'enum', options: ['prospect', 'active'], default: 'prospect' })
  status!: string;

  @Relation({ entity: () => Employee, onDelete: 'set null' })
  owner?: string;
}
```

Rules of the road:

- `@Entity` sets `name`/`label`/`permissions`/`list` — omit `name` and it is derived
  from the class name (`OrderItem` → `order_item`).
- `@Field` takes the `FieldDef` options (`type`, `required`, `unique`, `searchable`,
  `min`/`max`, `options` for enums, `format`, `ui`, …). Declare `type` explicitly.
- `@Relation({ entity: () => Other })` creates a `ref` (uuid + FK); the thunk is
  resolved after all modules load, so circular references are fine.
- System columns (`id`, `createdAt`, `updatedAt`, `deletedAt`) are managed by Mosaic;
  declaring them is optional and they are never part of `fields`.
- Inheritance works: base classes contribute their fields.
- `*.entity.json` still loads; a class with the same name wins.

## Docs

```bash
npm run docs:start   # http://localhost:3003
```

Highlights: `docs/docs/quickstart.md`, `entities.md`, `cli.md`, `migrations.md`,
`builder.md`, `component catalog`, `pwa.md`, `security.md`, `architecture.md`.

See [HANDOFF.md](./HANDOFF.md) for the running build log / status.
