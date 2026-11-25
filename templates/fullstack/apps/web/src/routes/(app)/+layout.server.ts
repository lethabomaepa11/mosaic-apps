import type { NavItemDef, PageDef } from '@mosaic-apps/core';
import { mosaicServer } from '#lib/server/mosaic';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ fetch, url }) => {
  if (['/login', '/signup'].includes(url.pathname)) return { navigation: [] as NavItemDef[] };
  const [{ rows: [setting] }, pagesResponse, session] = await Promise.all([
    (await mosaicServer()).db.query<{ value: NavItemDef[] }>("SELECT value FROM mosaic_settings WHERE key = 'app.nav'"),
    fetch('/api/pages?published=true&includeRestrictedRoutes=true'),
    fetch('/api/auth/me'),
  ]);
  if (!pagesResponse.ok) return { navigation: [] as NavItemDef[] };
  const { data } = await pagesResponse.json();
  const user = session.ok ? (await session.json()).data : null;
  const pages = (data ?? []) as PageDef[];
  const accessible = pages.filter((page) => {
    if (!page.root) return false;
    const roles = (page.settings as { roles?: string[] } | undefined)?.roles;
    return !roles?.length || user?.isAdmin || roles.some((role) => user?.roles?.includes(role));
  });
  const blocked = new Set(pages.filter((page) => !accessible.includes(page)).map((page) => page.route));
  const items: NavItemDef[] = Array.isArray(setting?.value) ? setting.value : accessible
    .filter((page) => page.settings?.menu?.show !== false && !page.route.split('/').some((part) => part.startsWith(':')))
    .sort((a, b) => (a.settings?.menu?.order ?? 99) - (b.settings?.menu?.order ?? 99))
    .map((page) => ({ label: (page.settings?.menu as { label?: string } | undefined)?.label ?? page.settings?.title ?? page.name, href: page.route, icon: page.settings?.menu?.icon, section: page.settings?.menu?.group }));
  return { navigation: items.filter((item) => typeof item?.label === 'string' && typeof item.href === 'string'
    && /^\/(?![/\\])/.test(item.href) && !/[\\\u0000-\u001f]/.test(item.href) && !blocked.has(item.href.split(/[?#]/, 1)[0]!)) };
};
