# Product acceptance fixtures

## Business app: service operations

A non-developer creates an authenticated service-management app with a public home
page, `/login`, dashboard, customers, work orders, staff roles, CRUD forms, tables,
filters, attachments, and audit history. They edit routes and UI without seeing
JSON. A developer then adds a package-backed calendar component, reviews an entity
migration, and deploys the same repository as one Vercel project against Neon and
again against Supabase PostgreSQL.

Acceptance requires keyboard-complete Studio editing, role-correct previews,
revision diff/conflict/restore, physical tables per entity, same-origin API health,
preview and production separation, and coordinated artifact/schema/code rollback.

## Passion app: community collection

A creator starts from a prompt and builds a public collection site with a designed
home page, nested item routes, image-backed entries, tags, search, an optional login
for contributors, responsive themes, and an accessible empty/error state. They can
download source without GitHub and obtain a verified build without connecting
Vercel. Connecting both services later creates a repository and one deployment
without changing the application model.

Acceptance requires direct visual editing, mobile/desktop preview, custom Svelte
takeover, export/import, no mandatory JSON work, and no dependency on hosted Studio
after the repository is downloaded.
