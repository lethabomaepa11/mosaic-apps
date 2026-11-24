import type { Handle } from '@sveltejs/kit/hooks';
import { sessionUser } from '#lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = await sessionUser(event.cookies).catch(() => null);
  return resolve(event);
};
