import { timingSafeEqual } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setSession } from '#lib/server/auth';
import { GITHUB_LOGIN_STATE, signInWithGitHub } from '#lib/server/github-login';
import { continuePendingProject } from '#lib/server/projects';
import { loginReturn } from '#lib/server/login-return';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const expected = Buffer.from(cookies.get(GITHUB_LOGIN_STATE) ?? '');
  const received = Buffer.from(url.searchParams.get('state') ?? '');
  cookies.delete(GITHUB_LOGIN_STATE, { path: '/auth/github' });
  const next = loginReturn(cookies.get('mosaic_github_login_return'));
  cookies.delete('mosaic_github_login_return', { path: '/auth/github' });
  const fail = (message: string) => redirect(303, `/login?${new URLSearchParams({ error: message, next })}`);
  // CSRF: the state must match the one this browser started with.
  if (!expected.length || expected.length !== received.length || !timingSafeEqual(expected, received)) throw fail('GitHub sign-in expired. Please try again.');
  const code = url.searchParams.get('code');
  if (!code) throw fail('GitHub sign-in was cancelled.');
  let user;
  try {
    user = await signInWithGitHub(url.origin, code);
  } catch (cause) {
    console.error('GitHub sign-in failed', cause);
    throw fail(cause instanceof Error && cause.message.includes('verified email') ? cause.message : 'GitHub sign-in failed. Please try again.');
  }
  setSession(cookies, user);
  if (next !== '/') throw redirect(303, next);
  const projectId = await continuePendingProject(cookies, user.id, url.origin);
  throw redirect(303, projectId ? `/projects/${projectId}` : '/');
};
