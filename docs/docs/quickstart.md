---
sidebar_position: 2
---

# Quickstart

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 14+ **or nothing** — Mosaic boots on embedded Postgres
  ([PGlite](https://electric-sql.com/docs/pglite)) when `DATABASE_URL` starts
  with `pglite://`. No Docker required for your first app.

## 1. Scaffold

```bash
npx @mosaic/cli create my-crm
cd my-crm
npm install
```

This creates an API (`apps/api`, Hono + `@mosaic/server`) and a PWA web app
(`apps/web`, SvelteKit). `@mosaic/*` dependencies are linked to your repo
checkout automatically when created from the monorepo — from a checkout run
`npm run create -- my-crm` (source, no publish) or `npm run link-cli` once and
then `mosaic create my-crm` from anywhere.

## 2. Run

```bash
cp .env.example .env
npm run dev          # API on :8787, web on :5173
```

Open http://localhost:5173 and sign in with `admin@mosaic.local` / `admin1234`
(the API seeds this on first boot when `SEED=true`).

## 3. Model something

```bash
mosaic entity Product --fields "name:string,sku:string,price:decimal,stock:int,active:boolean"
mosaic migrate
```

`mosaic entity` scaffolds a **class** in `apps/api/src/entities/product.entity.ts`
— edit it like any other TypeScript file. `migrate` prints every SQL statement
first (dry-run preview), then applies it. Your CRUD API exists immediately:

```bash
curl -X POST localhost:8787/api/entities/product \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Widget","price":19.99}'
```

## 4. Design a form

```bash
mosaic studio
```

Pick your entity's auto-suggested form (or drag components onto a blank
canvas), then press **Save** to persist and publish the form. Open the generated
`/f/<slug>` route in the web app. Install the PWA from your browser menu — the
form works offline.

## Where to go next

- [Entities](./entities.md) — field types, relations, permissions
- [Migrations](./migrations.md) — how the diff engine thinks
- [Builder guide](./builder.md) — Studio power features
- [PWA guide](./pwa.md) — offline, install prompts, caching
