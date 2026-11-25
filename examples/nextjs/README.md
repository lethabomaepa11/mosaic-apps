# Mosaic on Next.js

This example mounts the published Mosaic server in a Next.js App Router Route Handler.
Next.js serves the React app and the Mosaic API on one origin. Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/api/health`. Local development uses an embedded database
under `.mosaic-data`. To seed an administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD`
in `.env.local` before the first API request. Use a unique password and a stable
`MOSAIC_JWT_SECRET` when testing sessions across restarts.

For deployment, set `DATABASE_URL` to PostgreSQL and `MOSAIC_JWT_SECRET` to a random
secret of at least 32 characters. The Route Handler uses the Node.js runtime.

```sh
npm run build
npm test
```

The smoke test starts the production build with an isolated embedded database. The
[Next.js tracking issue](https://github.com/lethabomaepa11/mosaic-apps/issues/41)
covers the CLI scaffold, React rendering of Mosaic definitions, and live deployment.
