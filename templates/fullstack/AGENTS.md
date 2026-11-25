# Mosaic application instructions

Before changing this project, read `.agents/skills/mosaic-app/SKILL.md` and the
reference it selects for the task.

This is one SvelteKit app (`apps/web`): public routes in `src/routes/(app)`, the
API at `/api`, and Mosaic Studio at `/studio` (`src/routes/studio`, `src/lib/studio`).

Keep database-first pages/forms/settings in Mosaic APIs and Studio rather than
inventing filesystem JSON as a second source of truth. Business entities own
physical PostgreSQL tables. Preserve user-written Svelte and server extensions,
preview migrations before applying destructive SQL, and never commit secrets.

Run the narrowest relevant checks (`npm run check`), followed by `npm run build`
before delivery.
