# Mosaic on Next.js

Next.js serves React pages and the Mosaic API on one origin. Use Node.js 22 or later.

```sh
npx @mosaic-apps/cli create my-app --framework nextjs
cd my-app
npm run dev
```

If you are running this example directly, install its lockfile first.

```sh
npm ci
npm run dev
```

Open `/api/health` to verify the app and database. Local scaffolds use embedded PostgreSQL
under `data`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before the first API
request to seed an administrator. The scaffold generates a signing secret in `.env`.

Open `/studio` with an administrator or editor account to author pages and forms.
Studio uses the same `/api/pages` and `/api/forms` as the React app. React renders
published pages at their configured routes, with `:parameter` segments and sign-in for
protected pages. Published entity forms are available at `/f/<slug>` and can create
records through the same permission-checked API. The renderer supports common
headings, text, tables, navigation links, and basic record fields. Other component
types can be added in `app/mosaic-node.jsx`.

For deployment, configure durable PostgreSQL and a stable random `MOSAIC_JWT_SECRET`
of at least 32 characters. In Vercel, use the Next.js preset and the scaffold root
as the root directory. Set `DATABASE_URL` and the signing secret in the production
environment. Preview entity migrations with `mosaic migrate --dry-run` before applying
them with `mosaic migrate` against the target database.

```sh
npm run build
npm test
```

The production smoke test uses an isolated embedded database by default. CI also
runs it with a dedicated PostgreSQL database using `TEST_NEXT_DATABASE_URL`.
