import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { registerAccount, setSession } from '#lib/server/auth';
import { continuePendingProject } from '#lib/server/projects';
import { githubLoginEnabled } from '#lib/server/github-login';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) throw redirect(303, '/');
  return { githubLogin: githubLoginEnabled() };
};

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const password = String(data.get('password') ?? '');
    if (name.length < 2) return fail(400, { name, email, message: 'Enter your full name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, { name, email, message: 'Enter a valid email address.' });
    if (password.length < 8) return fail(400, { name, email, message: 'Use at least 8 characters for your password.' });
    const user = await registerAccount(name, email, password);
    if (!user) return fail(409, { name, email, message: 'An account with this email already exists.' });
    setSession(cookies, user);
    // A prompt typed before signing in becomes the user's first project right away.
    const projectId = await continuePendingProject(cookies, user.id, url.origin);
    throw redirect(303, projectId ? `/projects/${projectId}` : '/');
  },
};
