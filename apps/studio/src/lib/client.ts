import { goto } from '$app/navigation';
import { createClient } from '@mosaic-apps/ui';
import type { MosaicClient } from '@mosaic-apps/ui';

// PUBLIC_API_URL may be the API origin or end in /api (vite.config accepts both).
const hostedApi = import.meta.env.PUBLIC_API_URL ? `${import.meta.env.PUBLIC_API_URL.replace(/\/+$/, '').replace(/\/api$/, '')}/api` : '/api';

export const client: MosaicClient = createClient({
  // In dev the Vite proxy serves /api, keeping the HttpOnly session cookie and /files same-origin.
  baseUrl: import.meta.env.DEV ? '/api' : hostedApi,
  onUnauthorized: () => {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      void goto('/login');
    }
  },
});

export const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL || '';

