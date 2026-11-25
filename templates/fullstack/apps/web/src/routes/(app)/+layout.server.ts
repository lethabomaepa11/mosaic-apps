import type { NavItemDef, PageDef } from '@mosaic-apps/core';
import { mosaicServer } from '#lib/server/mosaic';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ fetch, url }) => {
  if (['/login', '/signup'].includes(url.pathname)) return { navigation: [] as NavItemDef[] };
  const { rows } = await (await mosaicServer()).db.query("SELECT 1 FROM mosaic_settings WHERE key = 'app.nav'");
  const response = await fetch(rows.length ? '/api/nav' : '/api/pages?published=true');
  if (!response.ok) return { navigation: [] as NavItemDef[] };
  const { data } = await response.json();
  const items: NavItemDef[] = rows.length ? data?.items ?? [] : ((data ?? []) as PageDef[])
    .filter((page) => page.settings?.menu?.show !== false && !page.route.split('/').some((part) => part.startsWith(':')))
    .sort((a, b) => (a.settings?.menu?.order ?? 99) - (b.settings?.menu?.order ?? 99))
    .map((page) => ({ label: page.settings?.title ?? page.name, href: page.route, icon: page.settings?.menu?.icon, section: page.settings?.menu?.group }));
  return { navigation: items.filter(({ href }) => /^\/(?![/\\])/.test(href) && !/[\\\u0000-\u001f]/.test(href)) };
};
