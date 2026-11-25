import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { authenticate, setSession } from '#lib/server/auth';
import { continuePendingProject } from '#lib/server/projects';
import { githubLoginEnabled } from '#lib/server/github-login';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) throw redirect(303, '/');
  return { githubLogin: githubLoginEnabled() };
};

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '');
    const user = await authenticate(email, String(data.get('password') ?? ''));
    if (!user) return fail(400, { email, message: 'Invalid email or password.' });
    setSession(cookies, user);
    // A prompt typed before signing in becomes the user's first project right away.
    const projectId = await continuePendingProject(cookies, user.id, url.origin);
    throw redirect(303, projectId ? `/projects/${projectId}` : '/');
  },
};
