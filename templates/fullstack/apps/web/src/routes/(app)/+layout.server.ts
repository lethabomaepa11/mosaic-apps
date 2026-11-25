import type { NavItemDef } from '@mosaic-apps/core';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ fetch, url }) => {
  if (['/login', '/signup'].includes(url.pathname)) return { navigation: [] as NavItemDef[] };
  const response = await fetch('/api/nav');
  if (!response.ok) return { navigation: [] as NavItemDef[] };
  const { data } = await response.json() as { data?: { items?: NavItemDef[] } };
  return { navigation: data?.items ?? [] };
};
