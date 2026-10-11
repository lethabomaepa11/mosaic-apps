---
sidebar_position: 4
---

# CLI reference

`mosaic <command> [options]`. Global: `-C, --dir <path>` to target another
directory, `-h/--help`.

## mosaic create

```bash
mosaic create "Acme CRM" [--db URL] [--auth on|off] [--demo|--no-demo]
  [--pwa|--no-pwa] [--port 8787] [--web-port 5173] [--db-port 5432]
  [--pm npm] [--install|--no-install] [--git|--no-git]
  [--link <repo>] [--npm-mode] [--force]
```

Copies `templates/fullstack`, replaces tokens (`__PROJECT_NAME__`,
`__PROJECT_SLUG__`, ports, flags), writes `.env` with a random JWT secret,
rewrites `@mosaic/*` to `file:` links (when run from the monorepo), generates
PWA icons, optionally `git init` + install. Also runs `npm install-scripts
approve esbuild` so `tsx` works under npm 11's script gate.

## mosaic migrate

```bash
mosaic migrate [--dry-run] [--allow-destructive|--no-allow-destructive]
```

Prints every planned statement grouped by entity, applies, records checksum
history. See [Migrations](./migrations.md).

## mosaic seed

```bash
mosaic seed [--demo]
```

Seeds roles, settings, admin (`admin@mosaic.local` / `admin1234`) and,
with `--demo`, sample entities, forms and pages.

## mosaic entity

```bash
mosaic entity Product --fields "name:string,sku:string,price:decimal,stock:int,active:boolean" [--soft-delete]
```

Field syntax: `name:type[:extra]` where extra is `refEntity` for `ref` or
`a|b|c` options for `enum`. Writes a **class** to
`apps/api/src/entities/product.entity.ts`, then run `mosaic migrate`.

## mosaic studio / dev / info

- `mosaic studio [--port 4173]` — starts the repo Studio pointed at this
  project's API (`PUBLIC_API_URL`).
- `mosaic dev` — runs the project's `npm run dev` (API + web together).
- `mosaic info` — config summary + live `/api/health` probe.

## Running the CLI from a checkout (before npm publish)

Nothing has to be published to scaffold an app:

```bash
# from the mosaic-apps checkout — runs the CLI straight from source
npm run create -- my-app                      # npm run mosaic -- create my-app

# or link the binary globally (builds first)
npm run link-cli
mosaic create my-app --link C:/path/to/mosaic-apps

# inside a generated app the workspace script works too
npx mosaic info
```

`create` rewrites `@mosaic/*` to `file:` links pointing at `<repo>/packages/*`
(`--link` overrides the auto-detected checkout, `--npm-mode` keeps registry
versions instead).

Run `npm run release:check` in the repository to build and dry-pack all public
workspace packages without publishing them. See [npm packages](./npm-packages.md)
for package requirements and release order.
