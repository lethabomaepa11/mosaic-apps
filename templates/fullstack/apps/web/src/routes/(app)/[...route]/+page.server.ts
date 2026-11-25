import { error, redirect } from '@sveltejs/kit';
import { createMosaicRouteLoader } from '@mosaic-apps/sveltekit';
import type { PageServerLoad } from './$types';

const loadPage = createMosaicRouteLoader();

export const load: PageServerLoad = async (event) => {
  const data = await loadPage(event);
  const roles = (data.mosaicPage.settings as { roles?: string[] } | undefined)?.roles;
  if (!roles?.length) return data;
  const response = await event.fetch('/api/auth/me');
  if (!response.ok) throw redirect(303, `/login?next=${encodeURIComponent(event.url.pathname)}`);
  const { data: user } = await response.json();
  if (!user?.isAdmin && !roles.some((role) => user?.roles?.includes(role))) throw error(403, 'This page is restricted to other roles');
  return data;
};
