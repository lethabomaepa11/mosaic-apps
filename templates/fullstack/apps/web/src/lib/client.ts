import { goto } from '$app/navigation';
import { createClient } from '@mosaic-apps/ui';

/**
 * The generated SvelteKit runtime mounts Hono at same-origin `/api`.
 * The app and Studio (`/studio`) share this one client so they share one session token.
 */
export const client = createClient({
  baseUrl: '/api',
  onUnauthorized: () => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path.startsWith('/studio')) {
      if (path !== '/studio/login') void goto('/studio/login');
    } else if (!path.startsWith('/login')) {
      window.location.href = '/login';
    }
  },
});
