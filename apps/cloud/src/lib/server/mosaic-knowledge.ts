import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __MOSAIC_FRAMEWORK_GUIDES__: Record<string, string> | undefined;

export function readFrameworkGuides(): Record<string, string> {
  const root = fileURLToPath(new URL('../../../../../docs/docs/', import.meta.url));
  return Object.fromEntries(readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.md'))
    .map((path) => [path.replaceAll('\\', '/'), readFileSync(join(root, path), 'utf8')]));
}

let guides: Record<string, string> | undefined;

export function frameworkGuideContext(task: string): string {
  guides ??= typeof __MOSAIC_FRAMEWORK_GUIDES__ === 'undefined' ? readFrameworkGuides() : __MOSAIC_FRAMEWORK_GUIDES__;
  const terms = new Set(task.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const sections = Object.entries(guides).flatMap(([path, guide]) => {
    const body = guide.replace(/^---[\s\S]*?\n---\s*/, '');
    const title = body.match(/^# (.+)$/m)?.[1] ?? path;
    return body.split(/(?=^#{1,3} )/m).filter((section) => section.trim()).map((section) => {
      const heading = section.split('\n', 1)[0]!;
      const keywords = new Set(`${path} ${title} ${heading}`.toLowerCase().match(/[a-z]{4,}/g) ?? []);
      return { path, section: section.trim(), score: [...keywords].filter((term) => terms.has(term) || terms.has(term + 's')).length };
    });
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
  if (!sections.length) return '';
  return '\n\nFRAMEWORK REFERENCE (shipped guides; the Cloud app schema still defines what can be generated):\n'
    + sections.slice(0, 3).map(({ path, section }) => `[${path}]\n${section.slice(0, 560)}`).join('\n\n');
}

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
- Sidebar comes from page settings. Set menuLabel, menuGroup and menuOrder to give users short task names in a useful order. For each role-specific screen, specify roles explicitly. Use inMenu false for pages reachable only from their parent workflow. A sidebar edit changes these page settings.
- For a signed-in request use submission.profile {entity,emailField} with a unique string email field. Example: {"profile":{"entity":"patient","emailField":"email"},"managed":[{"field":"patient","source":"profile","value":"id"},{"field":"status","source":"constant","value":"Requested"}],"selectable":["provider"]}. The patient field links to patient; provider links to a separate directory of bookable providers with explicit read access for every submitting role. Use source "profile" with value "organization" when the profile has that foreign key. Use userId/userEmail only for scalar identity fields, never as business record IDs. Keep ownership, tenant, and private links managed. Only use selectable for a directory whose whole records these users may read. If options require record-level or tenant filtering, report the limitation. Only user-entered fields appear in the form. Use a workflow page with a form section. Raw profile and request tables are administrator-only.
- Use datetime for appointment times the user chooses. Keep audit and lifecycle timestamps off customer forms: use submission.managed source "now" to record the current server time, and "empty" for optional datetimes that are unset on creation (for example rescheduleRequestedAt). Use value "" for both sources. Never imply a later action exists just because its timestamp exists.
- route: "/" or "/kebab-path"; no params. /api, /f, /login, /logout and /studio are platform routes. icon: a simple lucide name such as calendar, clipboard, or book-open.

SAMPLE DATA: 2-4 realistic records per entity, each record a plain object of fieldName to string value (e.g. {"fullName":"Thandi Nkosi","email":"thandi@example.com"}). For ref fields use the target record's labelField value. Enum values must be one of the options. Dates as YYYY-MM-DD. Always seed a matching sample profile with its unique email and context fields for preview submissions.

QUALITY BAR (MVP): every workflow in the brief must be possible with the entities, fields, enums (statuses) and relations; include status enums for things that move through stages; include dates/amounts the domain needs; no placeholder or duplicate entities.`;
