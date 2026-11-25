import { error } from '@sveltejs/kit';
import { allowRegistration } from '#lib/server/mosaic';
import { authPageLayout } from '#lib/server/auth-page';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  if (!allowRegistration) error(404, 'Sign-up is closed.');
  return { allowRegistration, registering: true, layout: await authPageLayout(true) };
};
