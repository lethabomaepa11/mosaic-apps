import { createClient } from '@mosaic/ui';
import type { MosaicClient } from '@mosaic/ui';

export const client: MosaicClient = createClient({
  baseUrl: '/api',
  onUnauthorized: () => {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  },
});

export const PUBLIC_API_URL = '';
