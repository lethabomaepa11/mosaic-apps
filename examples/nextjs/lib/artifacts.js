import { headers } from 'next/headers';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { mosaicServer } from './mosaic.js';

export const readMosaic = cache(async function readMosaic(path) {
  const cookie = (await headers()).get('cookie');
  const response = await (await mosaicServer()).app.fetch(new Request(`http://mosaic.local/api${path}`, {
    headers: cookie ? { cookie } : {},
  }));
  if (!response.ok) return { status: response.status };
  const result = await response.json();
  if (!result.success) throw new Error('Mosaic returned an invalid API response.');
  return { data: result.data };
});

export function signIn(path) {
  redirect(`/login?next=${encodeURIComponent(path)}`);
}

export function canManagePages(user) {
  return Boolean(user?.isAdmin || user?.permissions?.some((permission) => ['pages:manage', 'pages:*', '*'].includes(permission)));
}

export async function readAuthPage(route) {
  const { data } = await readMosaic('/pages?published=true');
  return data?.find((page) => page.route === route);
}

export async function publishedPage(segments) {
  const { data: pages } = await readMosaic('/pages?published=true&includeRestrictedRoutes=true');
  if (!pages) throw new Error('Mosaic pages are unavailable.');
  // shortcut: match the public route contract here until it is exported by the framework-neutral core.
  const candidates = pages.map((page) => ({ page, parts: page.route.split('/').filter(Boolean) }));
  const dynamicCount = (parts) => parts.filter((part) => part.startsWith(':')).length;
  candidates.sort((a, b) => dynamicCount(a.parts) - dynamicCount(b.parts));
  for (const { page, parts } of candidates) {
    if (parts.length !== segments.length) continue;
    if (!parts.every((part, index) => part.startsWith(':') || part === encodeURIComponent(segments[index]) || part === segments[index])) continue;
    if (!page.root) signIn('/' + segments.map(encodeURIComponent).join('/'));
    return page;
  }
  return undefined;
}

export async function publishedForm(id) {
  const { data: forms } = await readMosaic('/forms?published=true');
  if (!forms) throw new Error('Mosaic forms are unavailable.');
  return forms.find((form) => form.id === id || form.slug === id);
}

export async function recordFormProps(form, record) {
  const options = {};
  async function collect(node) {
    if (!node) return;
    const { binding, entity } = node.props ?? {};
    if (node.type === 'refSelect' && typeof binding === 'string' && typeof entity === 'string') {
      const path = '/entities/' + encodeURIComponent(entity);
      const { data } = await readMosaic(path + '?pageSize=100');
      const rows = data?.data ?? [];
      const value = record?.[binding];
      const retained = value && !rows.some((row) => row.id === value)
        ? (await readMosaic(path + '/' + encodeURIComponent(value))).data : undefined;
      const choices = retained ? [...rows, retained] : rows;
      options[binding] = choices.map((row) => ({ value: row.id, label: String(row.name ?? row.title ?? row.label ?? row.id) }));
    }
    await Promise.all((node.children ?? []).map(collect));
  }
  await collect(form.root);
  return { form, record, options };
}

export async function requirePublishedForm(id) {
  const form = await publishedForm(id);
  if (!form) notFound();
  return form;
}
