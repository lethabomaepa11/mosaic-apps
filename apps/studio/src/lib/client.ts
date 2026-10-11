import { createClient } from '@mosaic-apps/mosaic-ui';
import type { MosaicClient } from '@mosaic-apps/mosaic-ui';

export const client: MosaicClient = createClient({
  baseUrl: '/api',
  onUnauthorized: () => {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  },
});

export const PUBLIC_API_URL = '';

