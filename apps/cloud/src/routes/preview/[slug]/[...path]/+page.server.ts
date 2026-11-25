import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { previewPages, previewProject } from '#lib/server/preview';

export const load: PageServerLoad = async ({ params, locals, url }) => {
  if (!locals.user) throw redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
  const project = await previewProject(params.slug, locals.user.id);
  if (!project) throw error(404, 'Preview not found');
  const base = `/preview/${project.slug}`;
  const app = { name: project.name, slug: project.slug, theme: project.ui_theme, base };
  if (!project.app_spec) return { app, status: 'building' as const, page: null, nav: [] };

  const pages = await previewPages(project);
  const path = `/${params.path ?? ''}`.replace(/\/$/, '') || '/';
  const page = pages.find((item) => item.route === path) ?? (path === '/' ? pages.find((item) => item.settings?.menu?.show !== false) : undefined);
  // Navigation mirrors the deployed app: published pages flagged for the menu, in menu order.
  const nav = pages
    .filter((item) => item.settings?.menu?.show !== false)
    .sort((a, b) => (a.settings?.menu?.order ?? 99) - (b.settings?.menu?.order ?? 99))
    .map((item) => ({ label: item.settings?.title ?? item.name, href: `${base}${item.route === '/' ? '' : item.route}`, route: item.route, icon: item.settings?.menu?.icon ?? 'link' }));
  return { app, status: page ? ('ready' as const) : ('missing' as const), page: page ?? null, nav, path };
};
