---
title: Mosaic Cloud
---

# Mosaic Cloud

Start with a brief, review the generated app in a private preview, and decide whether to download or deliver the source. Choose SvelteKit or Next.js for the app runtime. Both generated scaffolds include the visual framework Studio. [Open Mosaic Cloud](https://cloud.mosaictalent.co.za)

## Build from a brief

1. Enter a brief of up to 24,000 characters and choose a framework under **Options**. Describe who uses the app, what each person can do, and which rules the server must enforce.
2. Answer questions in chat when decisions affect the design. **Decide for me** delegates open product choices. Cloud asks before reducing scope for unsupported requirements.
3. Open **Blueprint** to see the refined spec and build order. **Feature by feature** previews each checked feature as it is built. **One shot** attempts the agreed spec in a single build after brief refinement.
4. Try the result in **Preview**. Chat feedback during a staged build queues a change after that build. Inspect the plan and test workflows with the actual roles you intend to use before going live.

Cloud checks generated CRUD and supported submission paths against a database and uses AI to review the design. Complex approvals, balance accounting, row-level access and tenant isolation need [custom server logic](./extensions.md#server-extensions).

Cloud retrieves relevant excerpts from the framework guides when it plans, generates, or repairs an app. The builder still generates through its supported app spec. The exported source can use framework extensions and custom code.

Describe which values come from the signed-in user and which they choose. An invitation-only clinic can use existing patient profiles. A self-service clinic can create an account-bound profile on the first appointment request. The server assigns the patient and initial status. A provider picker can use a separate directory that the submitting role has permission to read. Keep private provider records separate from the directory.

## Edit the preview

Use **Open Studio** in the preview toolbar to edit a page or form. Use **Edit sidebar** to select and edit navigation links. In **Appearance**, set padding and margin for all sides or individual sides. Select **Page root** to edit spacing around a page.

Preview uses your Cloud session and a separate preview database. Visual saves affect that preview. Use the deployed app to test its real credentials, user roles and data. Preview changes persist across instance restarts when the Cloud installation has persistent preview storage configured.

## Deliver a release

Connect only the providers you need under **Settings → Connections**.

| Connection | What Cloud uses it for |
| --- | --- |
| GitHub | Creates a private repository and pushes release source. |
| Neon | Provisions durable PostgreSQL. |
| Vercel | Deploys the selected frontend and its same-origin API. Cloud delivery needs a provisioned database. |

Cloud queues delivery after a release when providers are connected. To send an existing release, use **Source & delivery → Deliver latest** after connecting your accounts. You can also download the release from that tab. The Vercel build installs the latest **published** Mosaic packages for the target framework.

When production is ready, workspace owners and admins can choose **View admin sign-in**, then **Reveal initial app sign-in**. Use those credentials at the deployed app's `/login`. Cloud-generated local downloads can use `admin@mosaic.local` / `admin1234` when you leave local bootstrap credentials unset.

If Vercel rejects a credential, reconnect it under **Settings → Connections** and check **Source & delivery → Activity** for the blocked job. For hosting outside Cloud's delivery setup, use [Manual deployment](./deployment.md).

## Accounts and live editing

For self-service registration, request it in the brief or enable **Allow public sign-up** in the project settings. After a new release, `/signup` assigns new accounts the viewer role. Keep sign-up closed for staff-only apps.

Open **Studio** at `/studio` in either deployed scaffold to edit forms, pages, and navigation. The Next.js runtime renders a subset of the Studio component palette. To publish generated changes from Cloud or upgrade an older release, create and deliver a new release. Preview and production each have their own published artifacts.

## AI models and limits

Cloud's shared tier routes across Groq models and can use a configured Gemini fallback. In **Settings → AI**, select Gemini, OpenAI, Anthropic, or DeepSeek to use your own key. If Gemini hits a temporary limit, Cloud tries a second Gemini model and can fall back to shared Groq. The build feed shows the responding model.

## Remove a project

Type the name in **Project Settings → Delete project**. Select GitHub, Vercel, or Neon explicitly if you want Cloud to delete those resources too. Selecting Neon deletes the project, including its branches and databases.

If a provider rejects deletion, the project remains visible so you can update the connection and retry. GitHub requires repository administration access and suitable deletion permissions. [GitHub repository deletion permissions](https://docs.github.com/en/rest/repos/repos#delete-a-repository)

## Developer takeover

Use `npm install` for a SvelteKit download and `npm ci` for a Next.js download, then run `npm run dev` at the repository root. Generated workflow releases include `mosaic/openapi.json` for typed clients. See [Server extensions](./extensions.md#server-extensions) for code locations and [App integrations](./app-integrations.md) for package and provider requirements.
