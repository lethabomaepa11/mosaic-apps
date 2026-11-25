# Verification and delivery

Choose checks proportional to the change:

```bash
npm run check   # svelte-check for the app and Studio (apps/web)
npm run build
```

For schema changes, review the migration plan before apply and verify existing data.
For UI changes, verify the edited route at desktop and mobile widths plus keyboard
operation. For auth/permissions, exercise an allowed and denied user.

Deployment invariants:

- Production uses durable PostgreSQL, not PGlite or function-local files.
- Keep the database and function region close and use serverless-safe pooling.
- Set a stable signing secret and explicit origins when origins differ.
- One deployment serves the app, `/api` and Studio at `/studio`.
- Preview environments use isolated data or provider branches.
- Page/form publishes can promote artifact revisions without rebuilding. Source,
  dependency, and schema changes require a verified build/deployment.
- Record the source commit, application release, migration, URL, and health result so
  rollback is reproducible.

Never commit `.env`, provider tokens, database URLs, or generated local data.
