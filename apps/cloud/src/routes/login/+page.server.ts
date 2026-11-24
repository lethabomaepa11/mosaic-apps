import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { authenticate, setSession } from '#lib/server/auth';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) throw redirect(303, '/');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '');
    const user = await authenticate(email, String(data.get('password') ?? ''));
    if (!user) return fail(400, { email, message: 'Invalid email or password.' });
    setSession(cookies, user);
    throw redirect(303, '/');
  },
};
