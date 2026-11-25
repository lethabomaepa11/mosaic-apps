import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { mosaicServer } from './mosaic.js';

export async function readMosaic(path) {
  const cookie = (await headers()).get('cookie');
  const response = await (await mosaicServer()).app.fetch(new Request(`http://mosaic.local/api${path}`, {
    headers: cookie ? { cookie } : {},
  }));
  if (!response.ok) return { status: response.status };
  const result = await response.json();
  if (!result.success) throw new Error('Mosaic returned an invalid API response.');
  return { data: result.data };
}

export function signIn(path) {
  redirect(`/login?next=${encodeURIComponent(path)}`);
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

export async function requirePublishedForm(id) {
  const form = await publishedForm(id);
  if (!form) notFound();
  return form;
}
