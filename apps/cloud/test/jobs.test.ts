import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.CLOUD_DATABASE_URL = 'pglite://memory';
process.env.CLOUD_ADMIN_EMAIL = '';
process.env.GROQ_API_KEY = 'test-key';
delete process.env.VERCEL;

const { getCloudDb } = await import('../src/lib/server/db');
const { claimJob, enqueueJob, queueLatestDelivery, runJob, runJobs } = await import('../src/lib/server/jobs');
const { deleteProject } = await import('../src/lib/server/projects');
const { encryptProviderSecret } = await import('../src/lib/server/providers');
const { equipmentSpec } = await import('./fixtures/equipment-spec');
const db = await getCloudDb();

// Fake Groq: answers as the three agents would. Tests set `agentQuestions` to make the planner ask.
let agentQuestions: Array<{ question: string; options: string[] }> = [];
const groqCalls: string[] = [];
function groqReply(body: any): Response {
  const name = body.response_format.json_schema.name as string;
  groqCalls.push(name);
  const content = name === 'mosaic_clarify' ? { thinking: ['Reading the brief'], questions: agentQuestions }
    : name === 'mosaic_review' ? { thinking: ['Every workflow is covered'], approved: true, issues: [] }
    : { thinking: ['Modelling equipment, employees and loans'], spec: equipmentSpec };
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
}
const baseFetch = globalThis.fetch;
let providerFetch: typeof fetch = baseFetch;
globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => String(input).includes('api.groq.com') ? groqReply(JSON.parse(String(init.body))) : providerFetch(input, init)) as typeof fetch;

async function createProject() {
  const organizationId = randomUUID(), projectId = randomUUID();
  await db.query('INSERT INTO cloud_organizations (id, name, slug) VALUES ($1, $2, $3)', [organizationId, 'Org', `org-${organizationId}`]);
  await db.query("INSERT INTO cloud_projects (id, organization_id, name, slug, prompt, status) VALUES ($1, $2, 'Northstar CRM', $3, 'Track customers and invoices', 'queued')", [projectId, organizationId, `northstar-${projectId.slice(0, 6)}`]);
  await db.query("INSERT INTO cloud_environments (id, project_id, name, kind) VALUES ($1, $2, 'Production', 'production')", [randomUUID(), projectId]);
  await db.query('INSERT INTO cloud_conversations (id, project_id) VALUES ($1, $2)', [randomUUID(), projectId]);
  return { organizationId, projectId };
}

async function connect(organizationId: string, provider: string, metadata: Record<string, unknown> = {}) {
  const secret = encryptProviderSecret(`${provider}-token`);
  await db.query(
    "INSERT INTO cloud_provider_connections (id, organization_id, provider, label, status, secret_ciphertext, secret_iv, secret_tag, metadata) VALUES ($1, $2, $3, $3, 'connected', $4, $5, $6, $7::jsonb)",
    [randomUUID(), organizationId, provider, secret.ciphertext, secret.iv, secret.tag, JSON.stringify(metadata)],
  );
}

// Runs every job that is due now, however long each takes (no wall-clock budgets to flake on a busy machine).
async function runDue(): Promise<void> {
  for (let job = await claimJob(db); job; job = await claimJob(db)) await runJob(db, job);
}

const jobsOf = async (projectId: string) => (await db.query<{ kind: string; status: string; error: string | null }>('SELECT kind, status, error FROM cloud_jobs WHERE project_id = $1 ORDER BY created_at', [projectId])).rows;

test('project deletion checks the name and role, then removes its queued work and saved data', async () => {
  const { organizationId, projectId } = await createProject();
  const userId = randomUUID(), releaseId = randomUUID();
  await db.query("INSERT INTO cloud_users (id, email, name, password_hash) VALUES ($1, $2, 'Test', '')", [userId, `${userId}@test.example`]);
  await db.query("INSERT INTO cloud_memberships (organization_id, user_id, role) VALUES ($1, $2, 'member')", [organizationId, userId]);
  assert.equal((await deleteProject(projectId, userId, 'Northstar CRM'))?.status, 403);
  await db.query("UPDATE cloud_memberships SET role = 'owner' WHERE organization_id = $1 AND user_id = $2", [organizationId, userId]);
  assert.equal((await deleteProject(projectId, userId, 'northstar crm'))?.status, 400);

  const jobId = await enqueueJob(db, { projectId, kind: 'generate' });
  await db.query("UPDATE cloud_jobs SET status = 'running' WHERE id = $1", [jobId]);
  assert.equal((await deleteProject(projectId, userId, 'Northstar CRM'))?.status, 409);
  await db.query("UPDATE cloud_jobs SET status = 'queued' WHERE id = $1", [jobId]);
  await db.query("INSERT INTO cloud_messages (id, conversation_id, role, content) SELECT $1, id, 'user', 'A message' FROM cloud_conversations WHERE project_id = $2", [randomUUID(), projectId]);
  await db.query("INSERT INTO cloud_releases (id, project_id, version, checksum, file_count) VALUES ($1, $2, 1, 'test', 1)", [releaseId, projectId]);
  await db.query("INSERT INTO cloud_release_files (release_id, path, content) VALUES ($1, 'package.json', '{}')", [releaseId]);

  assert.equal(await deleteProject(projectId, userId, 'Northstar CRM'), undefined);
  assert.equal((await deleteProject(projectId, userId, 'Northstar CRM'))?.status, 404);
  assert.deepEqual(await jobsOf(projectId), []);
  assert.equal((await db.query('SELECT 1 FROM cloud_release_files WHERE release_id = $1', [releaseId])).rows.length, 0);
  assert.equal((await db.query("SELECT 1 FROM cloud_audit_log WHERE target_id = $1 AND action = 'project.delete'", [projectId])).rows.length, 1);
});

test('a queued generate job plans, writes a release, and readies the project with no providers', async () => {
  const { projectId } = await createProject();
  await enqueueJob(db, { projectId, kind: 'generate', metadata: { prompt: 'Track customers and invoices' } });
  await runJobs(db, 5_000);
  assert.deepEqual(await jobsOf(projectId), [{ kind: 'generate', status: 'completed', error: null }]);
  const project = (await db.query<{ status: string; blueprint: unknown }>('SELECT status, blueprint FROM cloud_projects WHERE id = $1', [projectId])).rows[0]!;
  assert.equal(project.status, 'ready');
  assert.ok(project.blueprint);
  assert.equal((await db.query('SELECT 1 FROM cloud_releases WHERE project_id = $1', [projectId])).rows.length, 1);
  assert.equal((await db.query("SELECT 1 FROM cloud_messages WHERE role = 'assistant'")).rows.length >= 1, true);
});

test('a failing job records its error and fails the project', async () => {
  const { projectId } = await createProject();
  await enqueueJob(db, { projectId, kind: 'generate' });
  await runJobs(db, 5_000, { generate: async () => { throw new Error('boom'); } });
  assert.deepEqual(await jobsOf(projectId), [{ kind: 'generate', status: 'failed', error: 'boom' }]);
});

test('a stalled running job is requeued and claimed again', async () => {
  const { projectId } = await createProject();
  const jobId = await enqueueJob(db, { projectId, kind: 'generate' });
  await db.query("UPDATE cloud_jobs SET status = 'running', attempts = 1, started_at = now() - interval '1 hour' WHERE id = $1", [jobId]);
  const claimed = await claimJob(db);
  assert.equal(claimed?.id, jobId);
  assert.equal(claimed?.attempts, 2);
  await db.query("UPDATE cloud_jobs SET status = 'completed' WHERE id = $1", [jobId]);
});

test('connecting providers after generation lets the existing release reach GitHub, Neon and Vercel', async () => {
  const { organizationId, projectId } = await createProject();
  await enqueueJob(db, { projectId, kind: 'generate', metadata: { prompt: 'Track customers' } });
  await runDue();
  assert.deepEqual((await jobsOf(projectId)).map((job) => job.kind), ['generate']);
  assert.match(await queueLatestDelivery(db, projectId) ?? '', /Connect a provider/);
  for (const provider of ['neon', 'github', 'vercel']) await connect(organizationId, provider, provider === 'github' ? { login: 'octo' } : {});
  const calls: Array<{ method: string; url: string; body: any; auth: string | null }> = [];
  let deploymentState = 'BUILDING';
  providerFetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input), method = init.method ?? 'GET';
    calls.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : undefined, auth: new Headers(init.headers).get('authorization') });
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/api/v2/projects')) return reply({ project: { id: 'neon-1' }, connection_uris: [{ connection_uri: 'pglite://memory' }] }, 201);
    if (url.endsWith('/user/repos')) return reply({ full_name: 'octo/northstar' }, 201);
    if (url.endsWith('/repos/octo/northstar')) return reply({ default_branch: 'main' });
    if (url.endsWith('/git/ref/heads/main')) return reply({ object: { sha: 'parent-sha' } });
    if (url.endsWith('/git/trees')) return reply({ sha: 'tree-sha' }, 201);
    if (url.endsWith('/git/commits')) return reply({ sha: 'commit-sha' }, 201);
    if (url.endsWith('/git/refs/heads/main')) return reply({});
    if (url.endsWith('/v11/projects')) return reply({ id: 'prj_1' });
    if (url.endsWith('/v9/projects/prj_1') && method === 'PATCH') return reply({});
    if (url.includes('/v10/projects/prj_1/env')) return reply({});
    if (url.endsWith('/v13/deployments')) return reply({ id: 'dpl_1', readyState: 'QUEUED' });
    if (url.endsWith('/v13/deployments/dpl_1')) return reply({ readyState: deploymentState, alias: ['northstar.vercel.app'] });
    return reply({ message: `unexpected ${url}` }, 500);
  }) as typeof fetch;
  try {
    assert.equal(await queueLatestDelivery(db, projectId), undefined);
    assert.match(await queueLatestDelivery(db, projectId) ?? '', /current job/);
    await runDue();
    // Deployment polling is delayed; make it due now instead of waiting.
    await db.query("UPDATE cloud_jobs SET run_after = now() WHERE project_id = $1 AND status = 'queued'", [projectId]);
    await runDue();
    deploymentState = 'READY';
    await db.query("UPDATE cloud_jobs SET run_after = now() WHERE project_id = $1 AND status = 'queued'", [projectId]);
    await runDue();
  } finally {
    providerFetch = baseFetch;
  }
  assert.deepEqual((await jobsOf(projectId)).map((job) => `${job.kind}:${job.status}:${job.error ?? ''}`), ['generate:completed:', 'deliver:completed:', 'vercel-status:completed:']);
  const project = (await db.query<any>('SELECT status, github_repository, vercel_project_id, neon_project_id, database_secret FROM cloud_projects WHERE id = $1', [projectId])).rows[0];
  assert.equal(project.status, 'ready');
  assert.equal(project.github_repository, 'octo/northstar');
  assert.equal(project.vercel_project_id, 'prj_1');
  assert.equal(project.neon_project_id, 'neon-1');
  assert.ok(!JSON.stringify(project.database_secret).includes('pglite://'), 'database URL is stored encrypted');
  const environment = (await db.query<any>("SELECT status, url FROM cloud_environments WHERE project_id = $1 AND kind = 'production'", [projectId])).rows[0];
  assert.deepEqual(environment, { status: 'ready', url: 'https://northstar.vercel.app' });
  const tree = calls.find((call) => call.url.endsWith('/git/trees'))!;
  assert.ok(tree.body.tree.some((entry: any) => entry.path === 'package.json'));
  assert.deepEqual(calls.find((call) => call.url.endsWith('/git/commits'))!.body.parents, ['parent-sha']);
  assert.equal(calls.find((call) => call.url.includes('/env'))!.body.key, 'DATABASE_URL');
  assert.equal(calls.find((call) => call.url.endsWith('/v9/projects/prj_1'))?.body.rootDirectory, 'apps/web');
  assert.equal(calls.filter((call) => call.url.endsWith('/v13/deployments/dpl_1')).length, 2);
  const providerCalls = calls.filter((call) => !call.url.startsWith('https://northstar.vercel.app'));
  assert.ok(providerCalls.every((call) => call.auth === `Bearer ${call.url.includes('github') ? 'github' : call.url.includes('neon') ? 'neon' : 'vercel'}-token`));
  // After the deploy is ready, Cloud signs in to the live app to publish pages/data model through its API.
  assert.ok(calls.some((call) => call.url === 'https://northstar.vercel.app/api/auth/login'));
});

test('GitHub delivery refuses to commit into a repository Mosaic did not create', async () => {
  const { organizationId, projectId } = await createProject();
  await connect(organizationId, 'github', { login: 'octo' });
  providerFetch = (async () => new Response(JSON.stringify({ message: 'name already exists' }), { status: 422 })) as typeof fetch;
  try {
    await enqueueJob(db, { projectId, kind: 'generate', metadata: { prompt: 'Track customers' } });
    await runDue();
  } finally {
    providerFetch = baseFetch;
  }
  const deliver = (await jobsOf(projectId)).find((job) => job.kind === 'deliver')!;
  assert.equal(deliver.status, 'failed');
  assert.match(deliver.error ?? '', /already exists/);
});

test('the planner asks once; a chat reply resumes the same job and it never asks again', async () => {
  const { projectId } = await createProject();
  agentQuestions = [{ question: 'Who signs in?', options: ['Admins only', 'Admins and staff'] }];
  const jobId = await enqueueJob(db, { projectId, kind: 'generate', metadata: { prompt: 'Track customers and invoices' } });
  await runJobs(db, 5_000);
  const paused = (await db.query<{ status: string; metadata: any }>('SELECT status, metadata FROM cloud_jobs WHERE id = $1', [jobId])).rows[0]!;
  assert.equal(paused.status, 'waiting_input');
  assert.equal(paused.metadata.questions[0].question, 'Who signs in?');
  assert.equal((await db.query<{ status: string }>('SELECT status FROM cloud_projects WHERE id = $1', [projectId])).rows[0]!.status, 'needs_input');

  // What the iterate action does with the user's reply.
  await db.query("UPDATE cloud_jobs SET status = 'queued', run_after = now(), metadata = metadata || $2::jsonb WHERE id = $1", [jobId, JSON.stringify({ answers: [{ question: 'Who signs in?', answer: 'just do anything' }], skipQuestions: true })]);
  groqCalls.length = 0;
  await runJobs(db, 10_000);
  assert.equal((await db.query<{ status: string }>('SELECT status FROM cloud_jobs WHERE id = $1', [jobId])).rows[0]!.status, 'completed');
  assert.ok(!groqCalls.includes('mosaic_clarify'), 'no second round of questions after an answer');

  // A later change on the same project is built without asking, even if the planner would.
  await enqueueJob(db, { projectId, kind: 'generate', metadata: { prompt: 'Add invoices', revise: true } });
  groqCalls.length = 0;
  await runJobs(db, 10_000);
  assert.ok(!groqCalls.includes('mosaic_clarify'));
  agentQuestions = [];
});

test('a generated app is the verified spec with real Mosaic artifacts in the release', async () => {
  const { projectId } = await createProject();
  await enqueueJob(db, { projectId, kind: 'generate', metadata: { prompt: 'Track equipment loans' } });
  await runJobs(db, 10_000);
  const project = (await db.query<{ app_spec: any; status: string }>('SELECT app_spec, status FROM cloud_projects WHERE id = $1', [projectId])).rows[0]!;
  assert.equal(project.status, 'ready');
  assert.deepEqual(project.app_spec.entities.map((entity: any) => entity.name), ['employee', 'equipment', 'loan']);
  const paths = (await db.query<{ path: string }>('SELECT file.path FROM cloud_release_files file JOIN cloud_releases release ON release.id = file.release_id WHERE release.project_id = $1', [projectId])).rows.map((row) => row.path);
  for (const path of ['mosaic/spec.json', 'apps/web/src/lib/server/entities/loan.entity.json', 'apps/web/src/lib/server/mosaic-app.json', 'apps/web/src/routes/studio/+layout.svelte']) assert.ok(paths.includes(path), path);
  const log = (await db.query<{ log: Array<{ agent?: string }> }>('SELECT log FROM cloud_jobs WHERE project_id = $1', [projectId])).rows[0]!.log;
  for (const agent of ['Developer', 'Verifier', 'Reviewer']) assert.ok(log.some((entry) => entry.agent === agent), `${agent} shows its thinking`);
});
