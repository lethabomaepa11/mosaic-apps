/**
 * What every agent must know to build with Mosaic, condensed from docs/docs/{entities,
 * auto-crud,architecture,form-json}.md and the template's mosaic-app skill. Kept short:
 * the free Groq tier allows ~8k tokens per minute across prompt and answer.
 */
export const MOSAIC_KNOWLEDGE = `MOSAIC PLATFORM (you are building a Mosaic app):
- A Mosaic app is one SvelteKit project with a same-origin API. Entities are the source of truth: each entity becomes a physical PostgreSQL table, a validated REST CRUD API (/api/entities/<name>), pickers and forms. Migrations are computed automatically.
- Pages, forms, navigation and theme are database records published through the API (no rebuild). Sign-in (/login), users, roles, audit and soft delete are built in.
- You describe the app as an APP SPEC; Mosaic compiles it. Do not invent other files or components.

ENTITIES:
- name: snake_case singular business noun (e.g. "loan", "work_order"). Reserved (never use): auth, forms, pages, users, roles, settings, audit, reflists, files, migrations, meta, health, entities, openapi. For people use "member", "staff", "customer", "employee"... (platform login users are separate).
- Do NOT declare id, createdAt, updatedAt, deletedAt: Mosaic adds them.
- labelField: the field shown when another record links to this one (usually a name/title/reference string field).
- Field types: string (short text; format email|url|phone|money optional), text (long notes), int, decimal (money: format "money"), boolean, date, datetime, enum (options: 2+ human labels, e.g. ["Open","In progress","Closed"]), ref (link to another entity: refEntity=<entity name>; creates a foreign key and a record picker).
- Use ref for every relationship (a loan has item:ref→equipment and borrower:ref→employee). Many-to-many needs a join entity with two refs.
- required for must-have fields; unique for natural keys (serial numbers, emails, codes); searchable for fields users search by.
- Every field object has ALL keys: use refEntity "" unless type is ref, format "" unless it applies, options [] unless type is enum. Every page object has ALL keys: entity "" when not a list/dashboard page.
- permissions per action (read/create/update/delete) are role-name lists; [] means any signed-in user; "admin" can always do everything. Keep delete for admins unless the brief says otherwise.

PAGES:
- kind "list" + entity: a full CRUD screen for that entity (searchable sortable table, create, edit, delete, record detail). EVERY entity needs exactly one list page.
- kind "dashboard": stat cards per entity plus a recent-records table (set entity to the most important one).
- kind "home": public landing page at route "/" (only if the brief wants a public homepage).
- route: "/" or "/kebab-path"; no params, not /api or /login. access "authenticated" for business screens. inMenu true for main navigation. icon: a simple lucide name (home, grid, users, box, calendar, clipboard, file-text, settings...).

SAMPLE DATA: 2-4 realistic records per entity, each record a plain object of fieldName to string value (e.g. {"fullName":"Thandi Nkosi","email":"thandi@example.com"}). For ref fields use the target record's labelField value. Enum values must be one of the options. Dates as YYYY-MM-DD.

QUALITY BAR (MVP): every workflow in the brief must be possible with the entities, fields, enums (statuses) and relations; include status enums for things that move through stages; include dates/amounts the domain needs; no placeholder or duplicate entities.`;
