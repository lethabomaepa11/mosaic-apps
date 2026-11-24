import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearSession } from '#lib/server/auth';

export const POST: RequestHandler = ({ cookies }) => {
  clearSession(cookies);
  throw redirect(303, '/login');
};
