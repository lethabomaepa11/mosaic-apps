import type { Handle } from '@sveltejs/kit/hooks';
import { sessionUser } from '#lib/server/auth';
import { transientCloudDbError } from '#lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
  try {
    event.locals.user = await sessionUser(event.cookies);
    return await resolve(event);
  } catch (cause) {
    if (!transientCloudDbError(cause)) throw cause;
    return new Response('Mosaic Cloud is reconnecting to its database. Please reload shortly.', {
      status: 503, headers: { 'retry-after': '3', 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
    });
  }
};
