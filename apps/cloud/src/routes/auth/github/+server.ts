import { randomBytes } from 'node:crypto';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hosted } from '#lib/server/db';
import { GITHUB_LOGIN_STATE, githubLoginEnabled, githubLoginUrl } from '#lib/server/github-login';

export const GET: RequestHandler = ({ cookies, url }) => {
  if (!githubLoginEnabled()) throw error(404, 'GitHub sign-in is not configured.');
  const state = randomBytes(24).toString('base64url');
  cookies.set(GITHUB_LOGIN_STATE, state, { path: '/auth/github', httpOnly: true, sameSite: 'lax', secure: hosted, maxAge: 600 });
  throw redirect(302, githubLoginUrl(url.origin, state), { external: ['https://github.com'] });
};
