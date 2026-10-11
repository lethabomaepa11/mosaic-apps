# @mosaic/server

Hono API and server platform for Mosaic apps, including PostgreSQL/PGlite
drivers, CRUD, auth/RBAC, migrations, form/page APIs, settings, audit, and files.

```bash
npm install @mosaic/server @mosaic/core
```

Create an app with `createMosaicServer({ databaseUrl })` or compose the exported
Hono modules. Production deployments should set a stable `MOSAIC_JWT_SECRET`,
configure `DATABASE_URL`, and decide their file-storage and auth policy.
