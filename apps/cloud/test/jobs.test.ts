import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.CLOUD_DATABASE_URL = 'pglite://memory';
process.env.CLOUD_ADMIN_EMAIL = '';
delete process.env.GROQ_API_KEY;
delete process.env.VERCEL;

const { getCloudDb } = await import('../src/lib/server/db');
const { claimJob, enqueueJob, runJobs } = await import('../src/lib/server/jobs');
const { encryptProviderSecret } = await import('../src/lib/server/providers');
const db = await getCloudDb();

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

const jobsOf = async (projectId: string) => (await db.query<{ kind: string; status: string; error: string | null }>('SELECT kind, status, error FROM cloud_jobs WHERE project_id = $1 ORDER BY created_at', [projectId])).rows;

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

test('delivery provisions Neon, commits to GitHub, deploys to Vercel, and tracks the deployment', async () => {
  const { organizationId, projectId } = await createProject();
  for (const provider of ['neon', 'github', 'vercel']) await connect(organizationId, provider, provider === 'github' ? { login: 'octo' } : {});
  const calls: Array<{ method: string; url: string; body: any; auth: string | null }> = [];
  let deploymentState = 'BUILDING';
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
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
    if (url.includes('/v10/projects/prj_1/env')) return reply({});
    if (url.endsWith('/v13/deployments')) return reply({ id: 'dpl_1', readyState: 'QUEUED' });
    if (url.endsWith('/v13/deployments/dpl_1')) return reply({ readyState: deploymentState, alias: ['northstar.vercel.app'] });
    return reply({ message: `unexpected ${url}` }, 500);
  }) as typeof fetch;
  try {
    await enqueueJob(db, { projectId, kind: 'generate', metadata: { prompt: 'Track customers' } });
    await runJobs(db, 2_000);
    // Deployment polling is delayed; make it due now instead of waiting.
    await db.query("UPDATE cloud_jobs SET run_after = now() WHERE project_id = $1 AND status = 'queued'", [projectId]);
    await runJobs(db, 1_000);
    deploymentState = 'READY';
    await db.query("UPDATE cloud_jobs SET run_after = now() WHERE project_id = $1 AND status = 'queued'", [projectId]);
    await runJobs(db, 1_000);
  } finally {
    globalThis.fetch = realFetch;
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
  assert.equal(calls.filter((call) => call.url.endsWith('/v13/deployments/dpl_1')).length, 2);
  assert.ok(calls.every((call) => call.auth === `Bearer ${call.url.includes('github') ? 'github' : call.url.includes('neon') ? 'neon' : 'vercel'}-token`));
});

test('GitHub delivery refuses to commit into a repository Mosaic did not create', async () => {
  const { organizationId, projectId } = await createProject();
  await connect(organizationId, 'github', { login: 'octo' });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'name already exists' }), { status: 422 })) as typeof fetch;
  try {
    await enqueueJob(db, { projectId, kind: 'generate', metadata: { prompt: 'Track customers' } });
    await runJobs(db, 2_000);
  } finally {
    globalThis.fetch = realFetch;
  }
  const deliver = (await jobsOf(projectId)).find((job) => job.kind === 'deliver')!;
  assert.equal(deliver.status, 'failed');
  assert.match(deliver.error ?? '', /already exists/);
});
