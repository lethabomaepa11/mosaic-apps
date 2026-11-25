import { allowRegistration } from '#lib/server/mosaic';
import { authPageLayout } from '#lib/server/auth-page';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const registering = allowRegistration && url.searchParams.get('mode') === 'signup';
  return { allowRegistration, registering, layout: await authPageLayout(registering) };
};
