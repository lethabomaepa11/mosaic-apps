import { createClient } from '@mosaic-apps/ui';
import type { MosaicClient } from '@mosaic-apps/ui';

export const client: MosaicClient = createClient({
  baseUrl: import.meta.env.PUBLIC_API_URL || '/api',
  onUnauthorized: () => {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  },
});

export const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL || '';

