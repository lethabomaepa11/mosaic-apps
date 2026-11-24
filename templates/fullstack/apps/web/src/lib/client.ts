import { createClient } from '@mosaic-apps/ui';

/**
 * The generated SvelteKit runtime mounts Hono at same-origin `/api`.
 */
export const client = createClient({
  baseUrl: '/api',
  onUnauthorized: () => {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  },
});
