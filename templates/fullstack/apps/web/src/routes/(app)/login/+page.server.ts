import { allowRegistration } from '#lib/server/mosaic';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({ allowRegistration, registering: allowRegistration && url.searchParams.get('mode') === 'signup' });
