---
sidebar_position: 13
---

# Deployment

## What to ship

- **API** — `apps/api` builds to `dist/` (`tsc`); run `node --env-file=.env
  dist/index.js` (or any process manager). `adapter-node`-style standalone:
  no framework server needed, just Hono + `pg`.
- **Web** — SvelteKit `adapter-node` build; serve behind the same origin as
  the API (`/api` + `/files` proxied in dev, same-host in prod so the SW
  cache rules apply).
- **Database** — Postgres 14+. Run `mosaic migrate` from CI on deploy.

## Environment

| var | purpose |
|---|---|
| `DATABASE_URL` | `postgres://…` (prod) or `pglite://…` (throwaway/preview) |
| `MOSAIC_JWT_SECRET` | ≥32 random bytes, per environment |
| `PORT` | API port |
| `AUTH` | `on`/`off` |
| `SEED` / `SEED_DEMO` | `false` in production (seed once, then off) |
| `UPLOADS_DIR` | persistent volume for `mosaic_files` blobs |

## Checklist

- [ ] `SEED=false`, real `MOSAIC_JWT_SECRET`, TLS in front
- [ ] `mosaic migrate` in the deploy pipeline (idempotent)
- [ ] Backups before destructive migrations (renames = drop + add)
- [ ] `sw.js` VERSION bump when changing caching
- [ ] Health probe: `GET /api/health` → `{ ok, version, db }`
- [ ] PWA audit (manifest + icons + HTTPS)

## Docker sketch

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/apps/api/dist ./api
COPY --from=build /app/apps/web/build ./web
COPY --from=build /app/node_modules ./node_modules
ENV PORT=8787
CMD ["node", "--env-file=.env", "api/index.js"]
```

(Serve the web build with any static/Node adapter output alongside.)
