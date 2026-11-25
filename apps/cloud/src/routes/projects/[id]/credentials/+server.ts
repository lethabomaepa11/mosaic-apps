import { error, json } from '@sveltejs/kit';
import { deploymentCredentials } from '#lib/server/projects';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw error(401, 'Sign in to reveal app credentials.');
  const credentials = await deploymentCredentials(params.id, locals.user.id);
  if (!credentials) throw error(404, 'App credentials are unavailable.');
  return json(credentials, { headers: { 'cache-control': 'private, no-store' } });
};
