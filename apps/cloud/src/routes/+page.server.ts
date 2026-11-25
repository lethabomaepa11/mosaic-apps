import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCloudDb } from '#lib/server/db';
import { createProject, organizationFor, readProjectForm, savePendingProject } from '#lib/server/projects';

// The prompt page is public (like v0/Lovable); projects and connections need an account.
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) return { organization: null, projects: [], connections: [] };
  const db = await getCloudDb();
  const organization = await organizationFor(locals.user.id);
  if (!organization) return { organization: null, projects: [], connections: [] };
  const [projects, connections] = await Promise.all([
    db.query<{ id: string; name: string; slug: string; prompt: string; status: string; updated_at: string }>(
      'SELECT id, name, slug, prompt, status, updated_at FROM cloud_projects WHERE organization_id = $1 ORDER BY updated_at DESC', [organization.id],
    ),
    db.query<{ provider: string; status: string; label: string }>(
      'SELECT provider, status, label FROM cloud_provider_connections WHERE organization_id = $1 ORDER BY provider', [organization.id],
    ),
  ]);
  return { organization, projects: projects.rows, connections: connections.rows };
};

export const actions: Actions = {
  create: async ({ request, locals, url, cookies }) => {
    const input = readProjectForm(await request.formData());
    if ('error' in input) return fail(400, { message: input.error });
    if (!locals.user) {
      // Keep the prompt and continue right after sign-up/sign-in.
      await savePendingProject(cookies, input);
      throw redirect(303, '/signup?continue=project');
    }
    let projectId: string;
    try {
      projectId = await createProject(locals.user.id, input, url.origin);
    } catch (cause) {
      return fail(403, { message: cause instanceof Error ? cause.message : 'Could not create the project.' });
    }
    throw redirect(303, `/projects/${projectId}`);
  },
};
