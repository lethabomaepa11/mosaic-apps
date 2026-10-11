---
sidebar_position: 2
---

# Create your first application

## Requirements

- Node.js 22.17 or newer and npm 11 or newer.
- A terminal and a browser.

Use embedded PostgreSQL for local development, or supply a PostgreSQL connection
string with `--db`. The example below stores local data in a directory so it
survives API restarts.

## 1. Create the project

```bash
npx @mosaic-apps/cli@latest create my-crm
cd my-crm
```

The CLI creates an API, a web application, and Studio. It also creates `.env`
with your database URL and a generated JWT secret. Keep that file private.
It installs dependencies automatically. Use `--no-install` if you prefer to run
`npm install` yourself. Local data persists in the project's `data/` directory.

## 2. Start the application

```bash
npm run dev
```

| Application | Local address |
| --- | --- |
| Web application | `http://localhost:3000` |
| API | `http://localhost:3001/api/health` |
| Studio | `http://localhost:3002` |

The development command starts all three applications. You can also run
`npx mosaic studio` to open Studio separately. With demo seeding enabled, sign in
using `admin@mosaic.local` and `admin1234`. Replace the demo account before deploying.

### Resolve startup conflicts

The launcher checks that all three ports are free before starting. If another
application is using one, stop that application or choose different ports in `.env`:

```dotenv
PORT=3101
MOSAIC_WEB_PORT=3100
MOSAIC_STUDIO_PORT=3102
```

Restart `npm run dev` after editing `.env`. Both frontend API proxies follow the
configured API port. If you change the frontend port, also update `CORS_ORIGINS`
when calling the API directly from that browser origin.

Embedded PostgreSQL does not use port 5432. If you explicitly chose external
PostgreSQL and see `database does not exist` or `ECONNREFUSED`, create/start the
database configured in `DATABASE_URL`. For the generated Docker service, use
`npm run db:up`. If its database port is occupied, choose another `MOSAIC_DB_PORT`
and use that port in `DATABASE_URL`; keep other databases running.

## 3. Create a form

1. In Studio, open **Forms** and create a form named **Customer intake**.
2. Drag a **Text field** onto the canvas. Select it and set its label to **Name**
   and its data binding to `name`.
3. Add another text field bound to `email` and a **Date picker** bound to `startDate`.
4. Open **Form settings** to choose the entity, layout, and submit labels.
5. Click **Save**. Studio saves and publishes the definition.
6. Click **Preview** to try the fields inside Studio.

![Customer intake form in Studio](/img/screenshots/form-studio.png)

The generated web application renders published forms at `/f/<slug>` and pages
at `/p/<slug>`. Choose an entity when the form should create or update a record.

## 4. Add a business entity

```bash
npx mosaic entity Product --fields "name:string,sku:string,price:decimal,stock:int,active:boolean"
npx mosaic migrate --dry-run
npx mosaic migrate
```

Review the generated entity in `apps/api/src/entities/product.entity.ts` and the
migration preview before applying changes. Restart the API after adding entity
source files. Then choose the entity in Studio for field-binding suggestions
and entity-backed tables.

## Continue building

- [Studio guide](./builder.md): settings, actions, scripts, and reusable forms.
- [Component gallery](./components/gallery.md): screenshots and configuration examples.
- [Runtime state](./state-management.md): how inputs and actions share values.
- [Deployment](./deployment.md): database first, then API, then frontend.

The PWA can cache its application shell. Online API access is still needed for
record writes; do not assume offline submissions are synchronized automatically.
