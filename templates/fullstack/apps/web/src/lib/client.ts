import { createClient } from '@mosaic/ui';

/**
 * The dev server proxies /api to the Hono API (see vite.config.ts),
 * so a relative base works in dev and in the adapter-node build.
 */
export const client = createClient({
  baseUrl: '/api',
  onUnauthorized: () => {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  },
});
