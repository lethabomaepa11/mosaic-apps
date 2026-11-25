import { error, redirect } from '@sveltejs/kit';
import { walk, type FormDef, type PageDef } from '@mosaic-apps/core';
import type { PageServerLoad } from './$types';
import { previewPages, previewProject, previewRuntime } from '#lib/server/preview';
import { frameworkLabel } from '#lib/framework';
import { transientCloudDbError } from '#lib/server/db';

export const load: PageServerLoad = async ({ params, locals, url }) => {
  if (!locals.user) throw redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
  const project = await previewProject(params.slug, locals.user.id).catch((cause) => {
    if (transientCloudDbError(cause)) throw error(503, 'Cloud is reconnecting to its database. Reload the preview shortly.');
    throw cause;
  });
  if (!project) throw error(404, 'Preview not found');
  const base = `/preview/${project.slug}`;
  const app = { id: project.id, name: project.name, slug: project.slug, theme: project.ui_theme, framework: frameworkLabel(project.app_framework), base,
    liveUrl: project.live_url?.replace(/\/$/, ''), studioAvailable: project.app_framework !== 'nextjs', allowRegistration: project.app_spec?.allowRegistration === true };
  const path = `/${params.path ?? ''}`.replace(/\/$/, '') || '/';
  if (path === '/signup' && !app.allowRegistration) throw error(404, 'Sign-up is closed.');
  if (!project.app_spec) return { app, status: 'building' as const, page: null, nav: [] };

  const pages = await previewPages(project).catch((cause) => {
    console.error('Could not start the Cloud preview', cause);
    return undefined;
  });
  if (!pages) return { app, status: 'unavailable' as const, page: null, nav: [] };
  if (path === '/login' || path === '/signup') {
    const authPage = pages.find((item) => item.route === path);
    const title = authPage?.root.children?.find((node) => node.type === 'heading')?.props?.text;
    return { app, status: 'sign-in' as const, page: null, nav: [], registering: path === '/signup', authTitle: typeof title === 'string' ? title : undefined };
  }
  const page = pages.find((item) => item.route === path) ?? (path === '/' ? pages.find((item) => item.settings?.menu?.show !== false) : undefined);
  // Navigation mirrors the deployed app: published pages flagged for the menu, in menu order.
  const nav = pages
    .filter((item) => item.settings?.menu?.show !== false)
    .sort((a, b) => (a.settings?.menu?.order ?? 99) - (b.settings?.menu?.order ?? 99))
    .map((item) => ({ label: item.settings?.title ?? item.name, href: `${base}${item.route === '/' ? '' : item.route}`, route: item.route, icon: item.settings?.menu?.icon ?? 'link' }));
  if (path === '/studio') {
    const { call } = await previewRuntime(project);
    const forms = await call('GET', '/api/forms?published=true');
    if (forms.status !== 200) return { app, status: 'unavailable' as const, page: null, nav };
    return { app, status: 'studio' as const, page: null, nav,
      studioPages: pages.map(({ id, slug, name, route, settings }) => ({ id, slug, name, route, requiresAuth: settings?.requiresAuth })),
      studioForms: ((forms.body?.data ?? []) as FormDef[]).map(({ id, name, slug, entity }) => ({ id, name, slug, entity })),
      studioEntities: project.app_spec.entities.map(({ name, label, fields }) => ({ name, label, fields: fields.map(({ name, label, type }) => ({ name, label, type })) })),
    };
  }
  const formSlug = path.match(/^\/f\/([a-z0-9-]+)$/)?.[1];
  if (formSlug) {
    const { call } = await previewRuntime(project);
    const response = await call('GET', `/api/forms/${formSlug}`);
    const form = response.status === 200 ? response.body?.data as FormDef : undefined;
    if (form?.published) return { app, status: 'form' as const, page: null, nav, form };
  }
  return { app, status: page ? ('ready' as const) : ('missing' as const), page: page ? previewLinks(page, base) : null, nav, path };
};

function previewLinks(page: PageDef, base: string): PageDef {
  const result = structuredClone(page);
  walk(result.root, (node) => {
    const props = node.props;
    if (!props) return;
    const events = props.events as Record<string, Array<{ type: string; target?: string; to?: string }>> | undefined;
    for (const actions of [...Object.values(events ?? {}), props.actions]) for (const action of Array.isArray(actions) ? actions : []) {
      if (action?.type !== 'navigate' || typeof action.to !== 'string' || !action.to) continue;
      if (action.target === 'form') {
        action.to = `${base}/f/${encodeURIComponent(action.to)}`;
        action.target = 'url';
      } else if (action.target === 'url' && /^\/(?![/\\])/.test(action.to)) {
        action.to = `${base}${action.to}`;
      }
    }
  });
  return result;
}
