import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCloudDb, id, readCloud, transientCloudDbError } from '#lib/server/db';
import { isDaisyTheme } from '#lib/themes';
import type { ProjectBlueprint } from '#lib/server/groq';
import type { Answer, BuildFeature } from '#lib/server/agents';
import { enqueueJob, kickJobs, queueLatestDelivery } from '#lib/server/jobs';
import { canManageConnections } from '#lib/server/connections';
import { deleteProject } from '#lib/server/projects';
import type { Provider } from '#lib/server/providers';

const removing = (status: string | undefined) => status === 'deleting' || status === 'delete_failed';

async function projectFor(projectId: string, userId: string) {
  const result = await readCloud((db) => db.query<{
    id: string; organization_id: string; role: string; name: string; slug: string; prompt: string; status: string;
    include_home: boolean; include_login: boolean; app_framework: string; ui_system: string; ui_theme: string; allow_registration: boolean;
    blueprint: ProjectBlueprint | null; planner_model: string | null; planned_at: string | null;
    github_repository: string | null; vercel_project_id: string | null; neon_project_id: string | null;
  }>(
    // Explicit columns: this row is sent to the browser, and database_secret must never be.
    `SELECT project.id, project.organization_id, membership.role, project.name, project.slug, project.prompt, project.status,
       project.include_home, project.include_login, project.app_framework, project.ui_system, project.ui_theme,
       project.blueprint, project.planner_model, project.planned_at, project.github_repository,
       project.vercel_project_id, project.neon_project_id,
       COALESCE(project.app_spec->'allowRegistration' = 'true'::jsonb, false) AS allow_registration
     FROM cloud_projects project
     JOIN cloud_memberships membership ON membership.organization_id = project.organization_id
     WHERE project.id = $1 AND membership.user_id = $2`, [projectId, userId],
  ));
  return result.rows[0];
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/login');
  const project = await projectFor(params.id, locals.user.id);
  if (!project) throw error(404, 'Project not found');
  const [environments, jobs, messages, releases, generation] = await readCloud(async (db) => [
    await db.query<{ id: string; name: string; kind: string; status: string; url: string | null }>('SELECT id, name, kind, status, url FROM cloud_environments WHERE project_id = $1 ORDER BY kind DESC', [project.id]),
    await db.query<{ id: string; kind: string; status: string; progress: number; stage: string | null; error: string | null; created_at: string; started_at: string | null; lease_expires_at: string | null; run_after: string; log: Array<{ at: string; message: string; agent?: string }>; questions: Array<{ question: string; options: string[] }> | null }>("SELECT id, kind, status, progress, stage, error, created_at, started_at, lease_expires_at, run_after, log, metadata->'questions' AS questions FROM cloud_jobs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20", [project.id]),
    await db.query<{ id: string; role: string; content: string; created_at: string }>(
      `SELECT message.id, message.role, message.content, message.created_at
       FROM cloud_messages message JOIN cloud_conversations conversation ON conversation.id = message.conversation_id
       WHERE conversation.project_id = $1 ORDER BY message.created_at`, [project.id],
    ),
    await db.query<{ id: string; version: number; status: string; checksum: string; file_count: number; created_at: string }>('SELECT id, version, status, checksum, file_count, created_at FROM cloud_releases WHERE project_id = $1 ORDER BY version DESC LIMIT 10', [project.id]),
    await db.query<{ spec: string | null; features: BuildFeature[] | null; completed: number | null }>("SELECT metadata->>'refinedSpec' AS spec, metadata->'featurePlan' AS features, (metadata->>'completedFeatures')::int AS completed FROM cloud_jobs WHERE project_id = $1 AND kind = 'generate' AND metadata ? 'generationMode' ORDER BY created_at DESC LIMIT 1", [project.id]),
  ] as const).catch((cause) => {
    if (transientCloudDbError(cause)) throw error(503, 'Cloud is reconnecting to its database. Reload the project shortly.');
    throw cause;
  });
  // Reopening the builder resumes work no runner picked up (e.g. after a function was recycled).
  // Only overdue/stalled jobs count: the page polls every 2s and must not start a runner per poll.
  const now = Date.now();
  if (jobs.rows.some((job) => (project.status !== 'needs_input' && job.status === 'queued' && now - new Date(job.run_after).getTime() > 30_000)
    || (job.status === 'running' && now >= (job.lease_expires_at ? new Date(job.lease_expires_at).getTime() : new Date(job.started_at ?? job.created_at).getTime() + 10 * 60_000)))) kickJobs();
  return { project, environments: environments.rows, jobs: jobs.rows, messages: messages.rows, releases: releases.rows, generation: generation.rows[0] };
};

export const actions: Actions = {
  delete: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const form = await request.formData();
    const choices = form.getAll('deleteResources');
    const resources = [...new Set(choices.filter((value): value is Provider => value === 'github' || value === 'vercel' || value === 'neon'))];
    if (choices.some((value) => !resources.includes(value as Provider))) return fail(400, { deleteMessage: 'Select only attached provider resources.' });
    const result = await deleteProject(params.id, locals.user.id, form.get('projectName'), resources);
    if (result?.status) return fail(result.status, { deleteMessage: result.message });
    throw redirect(303, '/');
  },
  deliver: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const project = await projectFor(params.id, locals.user.id);
    if (!project) throw error(404, 'Project not found');
    if (!canManageConnections(project.role)) return fail(403, { deliveryMessage: 'Only workspace owners and admins can deliver a release.' });
    const message = await queueLatestDelivery(await getCloudDb(), project.id);
    if (message) return fail(409, { deliveryMessage: message });
    kickJobs();
    return { deliveryQueued: true };
  },
  settings: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const user = locals.user;
    const project = await projectFor(params.id, user.id);
    if (!project) throw error(404, 'Project not found');
    const form = await request.formData();
    const requestedTheme = String(form.get('uiTheme') ?? 'corporate');
    const requestedUiSystem = project.app_framework === 'nextjs' ? 'mosaic' : String(form.get('uiSystem') ?? 'daisyui');
    const registration = form.has('registrationSettings') ? form.get('allowRegistration') === 'on' : undefined;
    if (registration !== undefined && !canManageConnections(project.role)) return fail(403, { settingsMessage: 'Only workspace owners and admins can change public sign-up.' });
    if (!isDaisyTheme(requestedTheme) || !['daisyui', 'mosaic'].includes(requestedUiSystem)) {
      return fail(400, { settingsMessage: 'Choose a supported UI system and theme.' });
    }
    const db = await getCloudDb();
    const saved = await db.tx(async (tx) => {
      const { rows: [current] } = await tx.query<{ status: string }>('SELECT status FROM cloud_projects WHERE id = $1 FOR UPDATE', [project.id]);
      if (!current || removing(current.status)) return false;
      await tx.query(
        'UPDATE cloud_projects SET ui_system = $2, ui_theme = $3, updated_at = now() WHERE id = $1',
        [project.id, requestedUiSystem, requestedTheme],
      );
      await tx.query(
        `INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, 'project.settings.update', 'project', $4, $5::jsonb)`,
        [id(), project.organization_id, user.id, project.id, JSON.stringify({ appFramework: project.app_framework, uiSystem: requestedUiSystem, uiTheme: requestedTheme })],
      );
      // The built-in preview reads these settings live; the job carries them into source, Git and Vercel.
      const registrationChanged = registration !== undefined && registration !== project.allow_registration;
      const changed = registrationChanged || requestedTheme !== project.ui_theme || requestedUiSystem !== project.ui_system;
      if (changed && (await tx.query('SELECT 1 FROM cloud_releases WHERE project_id = $1 LIMIT 1', [project.id])).rows.length) await enqueueJob(tx, { projectId: project.id, kind: 'generate', metadata: { reuseBlueprint: true, userId: user.id, allowRegistration: registrationChanged ? registration : undefined }, stage: 'Waiting to apply app settings' });
      return true;
    });
    if (!saved) return fail(409, { settingsMessage: 'This project is being removed.' });
    kickJobs();
    return { settingsSaved: true, uiSystem: requestedUiSystem, uiTheme: requestedTheme };
  },
  iterate: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const project = await projectFor(params.id, locals.user.id);
    if (!project) throw error(404, 'Project not found');
    const form = await request.formData();
    const prompt = String(form.get('prompt') ?? '').trim();
    if (prompt.length < 3) return fail(400, { message: 'Describe the change you want.' });
    const db = await getCloudDb();
    const queued = await db.tx(async (tx) => {
      const { rows: [current] } = await tx.query<{ status: string }>('SELECT status FROM cloud_projects WHERE id = $1 FOR UPDATE', [project.id]);
      if (!current || removing(current.status)) return false;
      let conversation = await tx.query<{ id: string }>('SELECT id FROM cloud_conversations WHERE project_id = $1 ORDER BY created_at LIMIT 1', [project.id]);
      if (!conversation.rows[0]) {
        conversation = await tx.query<{ id: string }>('INSERT INTO cloud_conversations (id, project_id) VALUES ($1, $2) RETURNING id', [id(), project.id]);
      }
      // Resume the build that asked for clarification.
      const waiting = await tx.query<{ id: string; metadata: { generationMode?: string; answers?: Answer[]; questions?: Array<{ question: string }> } }>(
        "SELECT id, metadata FROM cloud_jobs WHERE project_id = $1 AND kind = 'generate' AND status = 'waiting_input' ORDER BY created_at DESC LIMIT 1", [project.id],
      );
      await tx.query('INSERT INTO cloud_messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4)', [id(), conversation.rows[0]!.id, 'user', prompt]);
      const pending = waiting.rows[0];
      if (pending) {
        const answer = { question: (pending.metadata.questions ?? []).map((item) => item.question).join(' / ') || 'Clarifications', answer: prompt };
        const refining = Boolean(pending.metadata.generationMode);
        const answers = refining ? [...(pending.metadata.answers ?? []), answer] : [answer];
        await tx.query("UPDATE cloud_jobs SET status = 'queued', attempts = 0, run_after = now(), stage = $3, metadata = metadata || $2::jsonb WHERE id = $1", [pending.id, JSON.stringify({ answers, skipQuestions: !refining, userId: locals.user!.id }), refining ? 'Refining with your answers' : 'Building with your answers']);
        await tx.query("UPDATE cloud_jobs SET status = 'cancelled', finished_at = now(), stage = 'Superseded by your answer' WHERE project_id = $1 AND status = 'waiting_input' AND id <> $2", [project.id, pending.id]);
      } else {
        await enqueueJob(tx, { projectId: project.id, kind: 'generate', metadata: { prompt, revise: true, userId: locals.user!.id }, stage: 'Waiting to plan the change' });
      }
      await tx.query("UPDATE cloud_projects SET status = 'queued', updated_at = now() WHERE id = $1", [project.id]);
      await tx.query(
        `INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id)
         VALUES ($1, $2, $3, 'generation.queue', 'project', $4)`,
        [id(), project.organization_id, locals.user!.id, project.id],
      );
      return true;
    });
    if (!queued) return fail(409, { message: 'This project is being removed.' });
    kickJobs();
    return { queued: true };
  },
  retry: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const project = await projectFor(params.id, locals.user.id);
    if (!project) throw error(404, 'Project not found');
    const jobId = String((await request.formData()).get('jobId') ?? '');
    const db = await getCloudDb();
    const result = await db.tx(async (tx) => {
      const { rows: [current] } = await tx.query<{ status: string }>('SELECT status FROM cloud_projects WHERE id = $1 FOR UPDATE', [project.id]);
      const { rows: [job] } = await tx.query<{ kind: string }>("SELECT kind FROM cloud_jobs WHERE id = $1 AND project_id = $2 AND status = 'failed'", [jobId, project.id]);
      if (!job || !current) return 404;
      if (job.kind === 'delete' && !canManageConnections(project.role)) return 403;
      if (current.status === 'deleting' || (removing(current.status) && job.kind !== 'delete')) return 409;
      await tx.query(`UPDATE cloud_jobs SET status = 'queued', attempts = 0, error = NULL, finished_at = NULL, run_after = now(), stage = 'Queued for retry',
        metadata = CASE WHEN kind = 'delete' THEN metadata || jsonb_build_object('userId', $2::text) ELSE metadata END WHERE id = $1`, [jobId, locals.user!.id]);
      await tx.query('UPDATE cloud_projects SET status = $2, updated_at = now() WHERE id = $1', [project.id, job.kind === 'delete' ? 'deleting' : 'queued']);
      return 200;
    });
    if (result !== 200) return fail(result, { message: result === 403 ? 'A workspace owner or admin must retry deletion.' : result === 409 ? 'This project is already being removed.' : 'That job cannot be retried.' });
    kickJobs();
    return { queued: true };
  },
};
