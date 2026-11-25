import type { Db } from '@mosaic-apps/server';
import { waitUntil } from '@vercel/functions';
import { getCloudDb, id } from './db';
import type { ProjectBlueprint } from './groq';
import { aiModel } from './ai';
import { aiConfigFor } from './ai-settings';
import type { Answer } from './agents';
import { buildApp } from './build-app';
import { publishToPreview } from './preview';
import { applyApp, httpCaller, loginToken } from './mosaic-runtime';
import { randomBytes } from 'node:crypto';
import { blueprintFromSpec, compileSpec, type AppSpec, type CompiledApp } from './spec';
import { persistGeneratedRelease, type GeneratedFile } from './generation';
import { decryptProviderSecret, encryptProviderSecret, type Provider } from './providers';
import { createGitHubRepository, createVercelProject, deployToVercel, provisionNeon, pushToGitHub, vercelDeploymentStatus } from './delivery';

export type JobKind = 'generate' | 'deliver' | 'vercel-status';
export interface ClaimedJob { id: string; project_id: string; kind: JobKind; metadata: Record<string, any>; attempts: number }
export interface JobContext { db: Db; job: ClaimedJob; stage(text: string, progress: number): Promise<void>; think(agent: string, message: string): Promise<void>; pause(questions: unknown[]): Promise<void>; enqueue(kind: JobKind, metadata: Record<string, unknown>, delaySeconds?: number): Promise<void>; requeue(delaySeconds: number, metadata: Record<string, unknown>): Promise<void> }
export type JobHandler = (context: JobContext) => Promise<void>;

const MAX_ATTEMPTS = 3;
const STALE_MINUTES = 10;

export async function enqueueJob(db: Db, input: { projectId: string; kind: JobKind; metadata?: Record<string, unknown>; stage?: string; delaySeconds?: number }): Promise<string> {
  const jobId = id();
  await db.query(
    `INSERT INTO cloud_jobs (id, project_id, kind, status, progress, stage, metadata, run_after)
     VALUES ($1, $2, $3, 'queued', 0, $4, $5::jsonb, now() + make_interval(secs => $6))`,
    [jobId, input.projectId, input.kind, input.stage ?? 'Queued', JSON.stringify(input.metadata ?? {}), input.delaySeconds ?? 0],
  );
  return jobId;
}

/** Claims the oldest runnable job, one at a time per project. Crashed jobs are requeued after STALE_MINUTES. */
export async function claimJob(db: Db): Promise<ClaimedJob | undefined> {
  await db.query(
    `UPDATE cloud_jobs SET status = CASE WHEN attempts >= $1 THEN 'failed' ELSE 'queued' END,
       error = CASE WHEN attempts >= $1 THEN 'The job stopped responding.' ELSE error END,
       finished_at = CASE WHEN attempts >= $1 THEN now() ELSE NULL END
     WHERE status = 'running' AND started_at < now() - make_interval(mins => $2)`,
    [MAX_ATTEMPTS, STALE_MINUTES],
  );
  // shortcut: two workers can still claim two jobs of one project in the same instant; add a per-project advisory lock if that shows up.
  const result = await db.query<ClaimedJob>(
    `UPDATE cloud_jobs SET status = 'running', started_at = now(), attempts = attempts + 1, error = NULL
     WHERE id = (
       SELECT job.id FROM cloud_jobs job
       WHERE job.status = 'queued' AND job.run_after <= now()
         AND NOT EXISTS (SELECT 1 FROM cloud_jobs other WHERE other.project_id = job.project_id AND other.status = 'running')
       ORDER BY job.created_at FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING id, project_id, kind, metadata, attempts`,
  );
  return result.rows[0];
}

export async function runJob(db: Db, job: ClaimedJob, handlers: Record<string, JobHandler> = HANDLERS): Promise<void> {
  const context: JobContext = {
    db, job,
    stage: async (text, progress) => {
      await db.query("UPDATE cloud_jobs SET stage = $2, progress = $3, log = log || jsonb_build_array(jsonb_build_object('at', now(), 'message', $2::text)) WHERE id = $1", [job.id, text, progress]);
    },
    think: async (agent, message) => {
      await db.query("UPDATE cloud_jobs SET stage = $2, log = log || jsonb_build_array(jsonb_build_object('at', now(), 'agent', $3::text, 'message', $2::text)) WHERE id = $1", [job.id, message.slice(0, 400), agent]);
    },
    // Waiting for the user's answers: the completion update below only touches running jobs, so this sticks.
    pause: async (questions) => {
      await db.query("UPDATE cloud_jobs SET status = 'waiting_input', stage = 'Waiting for your answers', metadata = metadata || jsonb_build_object('questions', $2::jsonb) WHERE id = $1", [job.id, JSON.stringify(questions)]);
      await db.query("UPDATE cloud_projects SET status = 'needs_input', updated_at = now() WHERE id = $1", [job.project_id]);
    },
    enqueue: async (kind, metadata, delaySeconds) => { await enqueueJob(db, { projectId: job.project_id, kind, metadata, delaySeconds }); },
    // Polling reschedules the same row (attempts reset) instead of piling up new jobs.
    requeue: async (delaySeconds, metadata) => { await db.query("UPDATE cloud_jobs SET status = 'queued', attempts = 0, metadata = $2::jsonb, run_after = now() + make_interval(secs => $3) WHERE id = $1", [job.id, JSON.stringify(metadata), delaySeconds]); },
  };
  try {
    const handler = handlers[job.kind];
    if (!handler) throw new Error(`Unknown job kind: ${job.kind}`);
    await handler(context);
    await db.query("UPDATE cloud_jobs SET status = 'completed', progress = 100, finished_at = now() WHERE id = $1 AND status = 'running'", [job.id]);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0, 500) : 'Unknown job error';
    console.error(`Job ${job.id} (${job.kind}) failed`, cause);
    await db.tx(async (tx) => {
      await tx.query("UPDATE cloud_jobs SET status = 'failed', error = $2, finished_at = now(), log = log || jsonb_build_array(jsonb_build_object('at', now(), 'message', $2::text)) WHERE id = $1", [job.id, message]);
      await tx.query("UPDATE cloud_projects SET status = 'failed', updated_at = now() WHERE id = $1", [job.project_id]);
    });
  }
}

/** Drains the queue within a time budget, sleeping briefly for delayed jobs (e.g. deployment polling). */
export async function runJobs(db: Db, budgetMs = 240_000, handlers: Record<string, JobHandler> = HANDLERS): Promise<number> {
  const deadline = Date.now() + budgetMs;
  let ran = 0;
  while (Date.now() < deadline) {
    const job = await claimJob(db);
    if (job) { await runJob(db, job, handlers); ran++; continue; }
    const next = await db.query<{ wait: number | null }>("SELECT EXTRACT(EPOCH FROM (MIN(run_after) - now())) * 1000 AS wait FROM cloud_jobs WHERE status = 'queued'");
    const wait = next.rows[0]?.wait;
    if (wait === null || wait === undefined || Date.now() + Number(wait) > deadline) return ran;
    await new Promise((resolve) => setTimeout(resolve, Math.max(250, Math.min(Number(wait), 15_000))));
  }
  return ran;
}

/** Runs queued work after the response is sent; on Vercel this extends the function lifetime. */
export function kickJobs(): void {
  waitUntil(getCloudDb().then((db) => runJobs(db)).catch((cause) => console.error('Job runner failed', cause)));
}

async function providerToken(db: Db, projectId: string, provider: Provider) {
  const result = await db.query<{ secret_ciphertext: string; secret_iv: string; secret_tag: string; metadata: Record<string, any> }>(
    `SELECT connection.secret_ciphertext, connection.secret_iv, connection.secret_tag, connection.metadata
     FROM cloud_provider_connections connection JOIN cloud_projects project ON project.organization_id = connection.organization_id
     WHERE project.id = $1 AND connection.provider = $2 AND connection.status = 'connected' LIMIT 1`, [projectId, provider],
  );
  const row = result.rows[0];
  // Only the workspace's own connection is ever used: projects land in the user's accounts, never the operator's.
  if (!row?.secret_ciphertext) return undefined;
  return { token: decryptProviderSecret({ ciphertext: row.secret_ciphertext, iv: row.secret_iv, tag: row.secret_tag }), metadata: row.metadata };
}

interface ProjectRow { id: string; name: string; slug: string; prompt: string; include_home: boolean; include_login: boolean; ui_system: string; ui_theme: string; blueprint: ProjectBlueprint | null; github_repository: string | null; vercel_project_id: string | null; neon_project_id: string | null; app_spec: AppSpec | null; deploy_secret: { ciphertext: string; iv: string; tag: string } | null; database_secret: { ciphertext: string; iv: string; tag: string } | null }

async function loadProject(db: Db, projectId: string): Promise<ProjectRow> {
  const result = await db.query<ProjectRow>('SELECT id, name, slug, prompt, include_home, include_login, ui_system, ui_theme, blueprint, github_repository, vercel_project_id, neon_project_id, app_spec, deploy_secret, database_secret FROM cloud_projects WHERE id = $1', [projectId]);
  if (!result.rows[0]) throw new Error('Project no longer exists.');
  return result.rows[0];
}

async function addMessage(db: Db, projectId: string, content: string) {
  await db.query(
    `INSERT INTO cloud_messages (id, conversation_id, role, content)
     SELECT $2, id, 'assistant', $3 FROM cloud_conversations WHERE project_id = $1 ORDER BY created_at LIMIT 1`, [projectId, id(), content],
  );
}

const generate: JobHandler = async ({ db, job, stage, think, pause, enqueue }) => {
  const project = await loadProject(db, job.project_id);
  await db.query("UPDATE cloud_projects SET status = 'generating', updated_at = now() WHERE id = $1", [project.id]);
  const options = `homepage=${project.include_home ? 'yes' : 'no'}, sign-in=${project.include_login ? 'yes' : 'no'}, theme=${project.ui_theme}`;
  const answers = (job.metadata.answers ?? []) as Answer[];
  let spec: AppSpec;
  let app: CompiledApp;
  if (job.metadata.reuseBlueprint && project.app_spec) {
    // Settings-only change (e.g. theme): rebuild, commit and redeploy the same verified spec.
    spec = project.app_spec;
    app = compileSpec(spec);
    await stage('Applying design settings', 40);
  } else {
    const revising = Boolean(job.metadata.revise && project.app_spec);
    // Everything the user has said counts, not just the first prompt (answers, "just do it", extra detail).
    const said = await db.query<{ content: string }>(
      `SELECT message.content FROM cloud_messages message JOIN cloud_conversations conversation ON conversation.id = message.conversation_id
       WHERE conversation.project_id = $1 AND message.role = 'user' ORDER BY message.created_at`, [project.id],
    );
    const notes = said.rows.map((row) => row.content).filter((content) => content !== project.prompt && content !== job.metadata.prompt);
    const brief = notes.length ? `${project.prompt}\n\nMore from the user (follow these):\n${notes.map((note) => `- ${note}`).join('\n')}` : project.prompt;
    // Ask at most once per project; after that the agents decide and state their assumptions.
    const askedBefore = await db.query("SELECT 1 FROM cloud_jobs WHERE project_id = $1 AND metadata ? 'questions' AND id <> $2 LIMIT 1", [project.id, job.id]);
    const ai = await aiConfigFor(job.metadata.userId as string | undefined);
    if (ai.provider !== 'mosaic') await think('Planner', `Using your own ${ai.provider === 'anthropic' ? 'Claude' : ai.provider === 'openai' ? 'OpenAI' : 'DeepSeek'} key (${aiModel(ai)})`);
    const result = await buildApp({
      ai, brief, answers, options,
      current: revising ? project.app_spec! : undefined, change: revising ? String(job.metadata.prompt ?? '') : undefined,
      askQuestions: !revising && !askedBefore.rows.length && !notes.length && !job.metadata.answers && !job.metadata.skipQuestions,
    }, { think, progress: async (percent) => { await db.query('UPDATE cloud_jobs SET progress = $2 WHERE id = $1', [job.id, percent]); } });
    if (result.status === 'needs_input') {
      await addMessage(db, project.id, `Before I build, a few quick questions:\n${result.questions.map((question) => `• ${question.question}`).join('\n')}`);
      await pause(result.questions);
      return;
    }
    ({ spec, app } = result);
    await db.query('UPDATE cloud_projects SET app_spec = $2::jsonb, blueprint = $3::jsonb, planner_model = $4, planned_at = now(), updated_at = now() WHERE id = $1', [project.id, JSON.stringify(spec), JSON.stringify(blueprintFromSpec(spec)), aiModel(ai)]);
    await addMessage(db, project.id, `${spec.summary}\n\nBuilt ${spec.entities.length} entities (${spec.entities.map((entity) => entity.labelPlural).join(', ')}) with ${spec.pages.length} pages, verified with real create/list/edit checks${result.reviewApproved ? ' and approved by the reviewer' : ''}.`);
  }
  await think('Verifier', 'Publishing the live preview…');
  await publishToPreview(project, spec, app);
  await stage('Packaging the release', 90);
  const release = await persistGeneratedRelease(db, { projectId: project.id, name: project.name, slug: project.slug, spec, app });
  const connected = await db.query<{ provider: string }>(
    `SELECT DISTINCT connection.provider FROM cloud_provider_connections connection JOIN cloud_projects project ON project.organization_id = connection.organization_id
     WHERE project.id = $1 AND connection.status = 'connected'`, [project.id],
  );
  if (connected.rows.length) await enqueue('deliver', { releaseId: release.id });
  await db.query("UPDATE cloud_projects SET status = $2, updated_at = now() WHERE id = $1", [project.id, connected.rows.length ? 'delivering' : 'ready']);
  await stage(`Release v${release.version} ready`, 100);
};

async function releaseFiles(db: Db, releaseId: string): Promise<{ version: number; files: GeneratedFile[] }> {
  const release = await db.query<{ version: number }>('SELECT version FROM cloud_releases WHERE id = $1', [releaseId]);
  if (!release.rows[0]) throw new Error('The release to deliver no longer exists.');
  const files = await db.query<GeneratedFile>('SELECT path, content, mode FROM cloud_release_files WHERE release_id = $1 ORDER BY path', [releaseId]);
  return { version: release.rows[0].version, files: files.rows };
}

/** Per-project secrets for the deployed app, generated once and stored encrypted. */
async function deploySecrets(db: Db, project: ProjectRow): Promise<{ jwtSecret: string; adminEmail: string; adminPassword: string }> {
  if (project.deploy_secret) return JSON.parse(decryptProviderSecret(project.deploy_secret));
  const owner = await db.query<{ email: string }>(
    `SELECT cloud_users.email FROM cloud_users JOIN cloud_memberships ON cloud_memberships.user_id = cloud_users.id
     JOIN cloud_projects ON cloud_projects.organization_id = cloud_memberships.organization_id
     WHERE cloud_projects.id = $1 ORDER BY (cloud_memberships.role = 'owner') DESC, cloud_memberships.created_at LIMIT 1`, [project.id],
  );
  const secrets = { jwtSecret: randomBytes(32).toString('hex'), adminEmail: owner.rows[0]?.email ?? 'admin@mosaic.local', adminPassword: randomBytes(18).toString('base64url') };
  await db.query('UPDATE cloud_projects SET deploy_secret = $2::jsonb WHERE id = $1', [project.id, JSON.stringify(encryptProviderSecret(JSON.stringify(secrets)))]);
  return secrets;
}

const deliver: JobHandler = async ({ db, job, stage, think, enqueue }) => {
  const project = await loadProject(db, job.project_id);
  const { version, files } = await releaseFiles(db, String(job.metadata.releaseId));

  // Neon only provisions the database; Mosaic migrates it from the app's own entity metadata.
  let databaseUrl: string | undefined;
  const neon = await providerToken(db, project.id, 'neon');
  if (neon) {
    let secret = project.database_secret;
    if (!secret) {
      await stage('Provisioning Neon PostgreSQL', 15);
      const provisioned = await provisionNeon({ token: neon.token, name: project.slug });
      secret = encryptProviderSecret(provisioned.connectionUri);
      await db.query('UPDATE cloud_projects SET neon_project_id = $2, database_secret = $3::jsonb, updated_at = now() WHERE id = $1', [project.id, provisioned.projectId, JSON.stringify(secret)]);
    }
    databaseUrl = decryptProviderSecret(secret);
  } else if (project.database_secret) {
    databaseUrl = decryptProviderSecret(project.database_secret);
  }

  const github = await providerToken(db, project.id, 'github');
  if (github) {
    await stage('Committing release to GitHub', 40);
    let repository = project.github_repository;
    if (!repository) {
      repository = await createGitHubRepository({ token: github.token, owner: String(github.metadata.login ?? ''), name: project.slug });
      await db.query('UPDATE cloud_projects SET github_repository = $2, updated_at = now() WHERE id = $1', [project.id, repository]);
    }
    const pushed = await pushToGitHub({ token: github.token, repository, files, message: `Mosaic release v${version}` });
    await stage(`Committed ${pushed.commit.slice(0, 7)} to ${pushed.repository}`, 60);
  }

  const vercel = await providerToken(db, project.id, 'vercel');
  if (vercel && !databaseUrl) {
    // A Mosaic app on Vercel needs durable PostgreSQL (docs/deployment-vercel.md).
    await think('Verifier', 'Skipped the Vercel deploy: connect Neon so the app gets a PostgreSQL database.');
  }
  if (vercel && databaseUrl) {
    await stage('Deploying to Vercel', 80);
    const secrets = await deploySecrets(db, project);
    let vercelProjectId = project.vercel_project_id;
    if (!vercelProjectId) {
      vercelProjectId = await createVercelProject({ token: vercel.token, name: project.slug, teamId: vercel.metadata.teamId });
      await db.query('UPDATE cloud_projects SET vercel_project_id = $2, updated_at = now() WHERE id = $1', [project.id, vercelProjectId]);
    }
    const env = {
      DATABASE_URL: databaseUrl, MOSAIC_JWT_SECRET: secrets.jwtSecret, MOSAIC_DEPLOY_TARGET: 'vercel', AUTH: 'on',
      SEED: 'true', SEED_DEMO: 'false', ADMIN_EMAIL: secrets.adminEmail, ADMIN_PASSWORD: secrets.adminPassword, MOSAIC_DB_POOL_MAX: '2',
    };
    const deployed = await deployToVercel({ token: vercel.token, projectId: vercelProjectId, name: project.slug, files, env, teamId: vercel.metadata.teamId });
    await db.query("UPDATE cloud_environments SET status = 'building', updated_at = now() WHERE project_id = $1 AND kind = 'production'", [project.id]);
    await enqueue('vercel-status', { deploymentId: deployed.deploymentId }, 10);
    await stage('Vercel deployment started', 90);
  } else {
    await db.query("UPDATE cloud_projects SET status = 'ready', updated_at = now() WHERE id = $1", [project.id]);
  }
};

const vercelStatus: JobHandler = async ({ db, job, stage, think, requeue }) => {
  const vercel = await providerToken(db, job.project_id, 'vercel');
  if (!vercel) throw new Error('Vercel was disconnected before the deployment finished.');
  const status = await vercelDeploymentStatus(vercel.token, String(job.metadata.deploymentId), vercel.metadata.teamId);
  if (status.state === 'READY') {
    await db.query("UPDATE cloud_environments SET status = 'ready', url = $2, updated_at = now() WHERE project_id = $1 AND kind = 'production'", [job.project_id, status.url]);
    // Artifact changes (entities, forms, pages) reach a live app through its API, without waiting for a rebuild.
    const project = await loadProject(db, job.project_id);
    if (status.url && project.app_spec && project.deploy_secret) {
      try {
        const secrets = JSON.parse(decryptProviderSecret(project.deploy_secret)) as { adminEmail: string; adminPassword: string };
        const token = await loginToken(httpCaller(status.url, ''), secrets.adminEmail, secrets.adminPassword);
        const applied = await applyApp(httpCaller(status.url, token), compileSpec(project.app_spec), { allowDestructive: false });
        await think('Verifier', applied.errors.length ? `Live app API update had problems: ${applied.errors[0]}` : 'Published the latest pages and data model to the live app.');
      } catch (cause) {
        await think('Verifier', `Could not update the live app through its API: ${cause instanceof Error ? cause.message : cause}`);
      }
    }
    await db.query("UPDATE cloud_projects SET status = 'ready', updated_at = now() WHERE id = $1", [job.project_id]);
    await stage(`Deployed to ${status.url}`, 100);
  } else if (status.state === 'ERROR' || status.state === 'CANCELED') {
    await db.query("UPDATE cloud_environments SET status = 'failed', updated_at = now() WHERE project_id = $1 AND kind = 'production'", [job.project_id]);
    throw new Error(`Vercel deployment ${status.state.toLowerCase()}${status.error ? `: ${status.error}` : ''}`);
  } else {
    const polls = Number(job.metadata.polls ?? 0);
    if (polls >= 90) throw new Error('The Vercel deployment did not finish within 15 minutes.');
    await stage(`Vercel build ${status.state.toLowerCase()}`, 95);
    await requeue(10, { ...job.metadata, polls: polls + 1 });
  }
};

const HANDLERS: Record<JobKind, JobHandler> = { generate, deliver, 'vercel-status': vercelStatus };
