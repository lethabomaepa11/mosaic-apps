---
sidebar_position: 14
---

# Deploy Studio, web and API

Deploy Studio when your team needs to design forms and pages from a shared URL.
Studio and your web application are separate frontends connected to the same API.
Definitions, records, accounts and published versions live in PostgreSQL.

![Form Studio used to design and publish an application](/img/screenshots/form-studio.png)

For Vercel and Neon, follow the [complete Vercel walkthrough](./deployment-vercel.md).
This guide covers persistent Node hosts, Netlify and Docker. It assumes a project
generated with Mosaic CLI 0.2.1 or newer and committed to your Git provider,
including `package-lock.json`. Keep `.env` and `data/` out of Git.

## 1. Choose your services

Reserve three application URLs, such as:

| Service | Example URL | Application directory |
| --- | --- | --- |
| API | `https://api.example.com` | `apps/api` |
| Web | `https://app.example.com` | `apps/web` |
| Studio | `https://studio.example.com` | `apps/studio` |

Each service gets its own environment variables. Database credentials and the
JWT signing secret belong to the API; web and Studio need the public API URL.

## 2. Provision the database

Create PostgreSQL on Neon, Supabase, Render or Railway. Choose a region near the
API. Store the provider connection string as the API's `DATABASE_URL`, preserving
the provider's TLS settings. For Neon serverless APIs, choose a pooled URL. Use
the [database setup instructions](./deployment.md#1-provision-postgresql) to choose
the appropriate connection for your provider.

## 3. Deploy and initialize the API

On Render, create a **Web Service** from the project repository. Keep the build
root at the repository root so npm can resolve all workspaces. On Railway,
create a service with the same commands:

| Setting | Value |
| --- | --- |
| Build command | `npm ci && npm run build -w apps/api` |
| Start command | `npm run start -w apps/api` |
| Health path | `/api/health` |
| Node version | 22.17 or newer, supported by your host |

Set these API environment variables in the hosting dashboard:

```dotenv
DATABASE_URL=<your-private-PostgreSQL-connection-string>
MOSAIC_JWT_SECRET=<a-stable-random-secret>
CORS_ORIGINS=https://app.example.com,https://studio.example.com
AUTH=on
SEED_DEMO=false
```

Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
For first-time setup, also set `SEED=true`, `ADMIN_EMAIL` and a strong
`ADMIN_PASSWORD`. Run `npm run migrate` as a controlled release/pre-deploy command,
then deploy. After checking administrator login, set `SEED=false` and remove the
administrator bootstrap variables. Keep `MOSAIC_JWT_SECRET` stable across releases.

If uploads are needed, attach a persistent disk or volume to the API and set
`UPLOADS_DIR` to its mount path. Check the API's `/api/health`: it should report
`ok: true` and `db: true`. Render supports configurable health checks; see
[Render web services](https://render.com/docs/web-services) and
[Render health checks](https://render.com/docs/health-checks).

## 4. Deploy the web application on Render or Railway

Create another Node web service from the same repository. Keep its build root
at the repository root. Set:

```dotenv
PUBLIC_API_URL=https://api.example.com/api
MOSAIC_APP_ORIGIN=https://app.example.com
HOST=0.0.0.0
```

Build with `npm ci && npm run build -w apps/web`; start with
`npm run start -w apps/web`. Leave `MOSAIC_DEPLOY_TARGET` unset to use the Node
adapter. Use the host's assigned `PORT`; do not run `npm run dev` in production.

## 5. Deploy Studio on Render or Railway

Create a third Node web service from the same repository. Set:

```dotenv
PUBLIC_API_URL=https://api.example.com/api
MOSAIC_APP_ORIGIN=https://studio.example.com
HOST=0.0.0.0
```

Build with `npm ci && npm run build -w apps/studio`; start with
`npm run start -w apps/studio`. Use `/login` as the service health path. Studio
does not receive `DATABASE_URL`, `MOSAIC_JWT_SECRET`, or administrator passwords
as deployment variables. Sign in with the API account created in step 3.

`PUBLIC_API_URL` is embedded at build time. Rebuild when changing the API URL.
The development Vite proxy is not part of the production Node server.

## Alternative: web and Studio on Netlify

Keep the database and API from steps 2–3. Create **two Netlify sites** from your
repository, one for each frontend:

| Setting | Web site | Studio site |
| --- | --- | --- |
| Base directory | Repository root | Repository root |
| Package directory | `apps/web` | `apps/studio` |
| Build command | `npm run build -w apps/web` | `npm run build -w apps/studio` |
| `MOSAIC_DEPLOY_TARGET` | `netlify` | `netlify` |
| `PUBLIC_API_URL` | `https://api.example.com/api` | Same API URL |
| `MOSAIC_APP_ORIGIN` | Web site's HTTPS origin | Studio site's HTTPS origin |

Let the SvelteKit adapter configure generated output and server functions.
Do not configure these as plain static exports. The generated apps use the
Netlify adapter compatible with SvelteKit 3. See
[SvelteKit on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/sveltekit/).

After Netlify assigns each site a domain, add both exact origins to API CORS
and redeploy the API. Apply the same process after adding custom domains.

## Alternative: Docker and other container hosts

Build from the generated project root:

```bash
docker build -f Dockerfile.api -t mosaic-api .
docker build -f Dockerfile.web --build-arg PUBLIC_API_URL=https://api.example.com/api --build-arg MOSAIC_APP_ORIGIN=https://app.example.com -t mosaic-web .
docker build -f Dockerfile.studio --build-arg PUBLIC_API_URL=https://api.example.com/api --build-arg MOSAIC_APP_ORIGIN=https://studio.example.com -t mosaic-studio .
```

Run these as separate services. Pass API secrets from your host's secret store.
Use the host's `PORT` or the image's local defaults: API 3001, web 3000 and
Studio 3002. Expose each service through HTTPS. Mount persistent storage only
on the API when using local uploads.

The same images can be used with Fly.io, Google Cloud Run, AWS ECS/App Runner,
Azure Container Apps, or a VPS with a container runtime. For platforms without
a durable writable volume, use an API host with persistent storage when uploads
are required. This template does not include an object-storage adapter.

## 6. Verify the whole application

1. Open Studio's `/login` and sign in with your bootstrap administrator.
2. Create a form, add a field, and click **Save** to publish it.
3. Open the form's `/f/<slug>` URL on the deployed web application.
4. Submit a record and confirm it appears in Studio's data view.
5. Open a JSON or script editor and confirm Monaco loads inside its modal.
6. On a persistent API host, upload an image and confirm it survives an API restart.
7. Remove bootstrap variables, confirm `SEED=false`, and back up the database.

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Studio loads but cannot reach the API | Include `/api` in `PUBLIC_API_URL`; rebuild Studio |
| Browser reports CORS errors | API CORS must include the exact Studio and web origins, without URL paths |
| HTML returned from an API call | The request reached Studio instead of the API; check the public API URL |
| Login stops working after a deploy | Keep the same JWT secret and confirm the API uses the same database |
| `npm run start` is missing | Upgrade the generated template or add `node build/index.js` as the frontend start script |
| Uploaded files disappear | The API needs a persistent volume; serverless upload routes are disabled |
