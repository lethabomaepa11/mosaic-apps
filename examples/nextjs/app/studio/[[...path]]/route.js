import { canManagePages, canManageSettings, readMosaic, signIn } from '../../../lib/artifacts.js';
import html from '../../../.studio-build/entry.mjs';

export async function GET(request, { params }) {
  const { path = [] } = await params;
  const url = new URL(request.url);
  const { data: user } = await readMosaic('/auth/me');
  if (!user) signIn(path.join('/') === 'login' ? '/studio' : url.pathname + url.search);
  if (!user.isAdmin && !user.roles?.includes('editor')) return new Response('Studio access required', { status: 404 });
  if (!path.length && url.searchParams.has('sidebar')) {
    return canManageSettings(user)
      ? new Response(null, { status: 307, headers: { location: '/studio/settings?tab=navigation' } })
      : new Response('Studio access required', { status: 404 });
  }
  const page = url.searchParams.get('page');
  if (!path.length && page && canManagePages(user)) {
    return new Response(null, { status: 307, headers: { location: `/studio/pages/${encodeURIComponent(page)}` } });
  }
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' } });
}
