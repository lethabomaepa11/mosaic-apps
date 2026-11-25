/**
 * What every agent must know to build with Mosaic, condensed from docs/docs/{entities,
 * auto-crud,architecture,form-json}.md and the template's mosaic-app skill. Kept short:
 * the free Groq tier allows ~8k tokens per minute across prompt and answer.
 */
export const MOSAIC_KNOWLEDGE = `MOSAIC PLATFORM (you are building a Mosaic app):
- SvelteKit and Next.js apps share the Mosaic runtime and a same-origin API. Entities define PostgreSQL tables, validated APIs, pickers and forms. Migrations are computed automatically.
- Pages, forms, navigation and theme are database records published through the API (no rebuild). Sign-in (/login), users, roles, audit and soft delete are built in.
- Set allowRegistration true if the brief calls for people to create their own accounts. Default to false for internal, staff-managed, or invitation-only apps. Self-registered users get the viewer role. Give viewer explicit read/create access for their tasks and reserve sensitive records, updates, and deletes for administrators. Permissions are entity-wide, so do not promise per-user record ownership.
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
- Start with the tasks someone opens the app to do. Put those tasks in the main navigation using kind "workflow" and custom sections. Each workflow needs a live records, metric or form section. Use workflow language for page titles and actions, for example "Reading schedule" with meetings, "RSVP for a meeting" opening the response form, and "Vote for the next book" opening the vote form.
- A page can have up to six ordered sections, with keys kind, title, body, entity. "spotlight" is domain-specific introductory copy (entity ""). "records" shows real records from the named entity. "metric" shows its live count. "form" opens the entity's working submission form with the section title as the action label. Use body for relevant instructions or "".
- "home" is the landing page at "/". "dashboard" with sections shows only the chosen blocks, so choose metrics and records useful for the role. Public pages can show spotlight sections. Workflows and business data require sign-in. The app already has /login.
- "list" + entity provides an admin-style management table. Include or let Mosaic generate a list for each entity. Set inMenu false for secondary management screens when the workflow already gives users the relevant task.
- route: "/" or "/kebab-path"; no params. /api, /f, /login, /logout and /studio are platform routes. icon: a simple lucide name such as calendar, clipboard, or book-open.

SAMPLE DATA: 2-4 realistic records per entity, each record a plain object of fieldName to string value (e.g. {"fullName":"Thandi Nkosi","email":"thandi@example.com"}). For ref fields use the target record's labelField value. Enum values must be one of the options. Dates as YYYY-MM-DD.

QUALITY BAR (MVP): every workflow in the brief must be possible with the entities, fields, enums (statuses) and relations; include status enums for things that move through stages; include dates/amounts the domain needs; no placeholder or duplicate entities.`;
