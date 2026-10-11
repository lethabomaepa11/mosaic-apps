---
sidebar_position: 1
---

# Introduction

**Mosaic** is a metadata-driven full-stack platform. You describe your domain
as entity classes (or JSON) plus forms and pages — and Mosaic turns them into a
running system:

- **PostgreSQL tables** via a diffing migration engine (plan SQL, review, apply)
- **REST APIs** with filters, sorts, pagination, soft delete, audit and RBAC —
  auto-generated per entity, no hand-written controllers
- **Drag & drop forms and pages** (59 component types) stored as JSON, with
  versioning, publish workflow and live preview
- **An installable SvelteKit PWA** per project (offline shell + offline data)
- **A CLI** (`mosaic create|migrate|seed|entity|studio|info`) that drives the loop

## Who is it for?

Teams that keep rebuilding the same internals: admin panels, CRUD apps,
data-entry forms, approval dashboards. If your spec is "a database with a nice
UI and permissions", Mosaic is the shortest path from model to production.

## The loop

```bash
mosaic create crm                    # scaffold API + PWA web
mosaic entity Customer \
  --fields "name:string,email:string,status:enum:prospect|active"   # model
mosaic migrate                       # preview SQL → apply
mosaic studio                        # design forms & pages, Save publishes forms
```

1. **Model** — `apps/api/src/entities/*.entity.ts` (or `.entity.json`)
2. **Migrate** — `mosaic migrate` shows every statement; `--dry-run` previews
3. **Design** — Studio renders the same JSON your PWA renders (shared `@mosaic-apps/mosaic-ui`)
4. **Deploy** — adapter-node API + PWA web; docs in [Deployment](./deployment.md)

## Project map

| Area | Code | What it is |
|---|---|---|
| Core | `packages/mosaic-core` | Entity/form/page types, validation, expressions, query spec |
| Server | `packages/mosaic-server` | Hono API: CRUD, auth, migrations, forms, files, admin |
| UI kit | `packages/mosaic-ui` | Svelte 5 components, FormRenderer, DnD engine, client |
| CLI | `packages/mosaic-cli` | `mosaic` binary |
| Studio | `apps/studio` | SvelteKit designer app |
| Template | `templates/fullstack` | What `mosaic create` copies |
| Docs | `docs` | This site |

Next: [Quickstart](./quickstart.md).
