import { createClient } from '@mosaic-apps/ui';

/**
 * Keep PUBLIC_API_URL empty for same-origin hosting, or set it to the API's
 * public URL when the web and API services are deployed separately.
 */
export const client = createClient({
  baseUrl: import.meta.env.PUBLIC_API_URL || '/api',
  onUnauthorized: () => {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      const next = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
    }
  },
});
