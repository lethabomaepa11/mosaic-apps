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
npx @mosaic-apps/cli create my-crm --db pglite://./data --no-install
cd my-crm
npm install
```

The CLI creates an API, a web application, and Studio. It also creates `.env`
with your database URL and a generated JWT secret. Keep that file private.

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
