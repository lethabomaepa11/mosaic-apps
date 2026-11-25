import { error, redirect, type RequestHandler, type ServerLoad } from '@sveltejs/kit';
import type { ApiResponse, PageDef } from '@mosaic-apps/core';
import { createMosaicServer, type MosaicServer, type MosaicServerConfig } from '@mosaic-apps/server';

export type MosaicServerProvider = () => Promise<MosaicServer>;

/** Lazily initialize one Mosaic server per warm SvelteKit process. Failed starts can retry. */
export function createMosaicServerProvider(config: MosaicServerConfig | (() => Promise<MosaicServer>)): MosaicServerProvider {
  let initialization: Promise<MosaicServer> | undefined;
  return () => {
    if (!initialization) {
      initialization = (typeof config === 'function' ? config() : createMosaicServer(config))
        .catch((cause) => {
          initialization = undefined;
          throw cause;
        });
    }
    return initialization;
  };
}

/** Forward a SvelteKit request to Hono without opening another port or deployment. */
export function createMosaicApiHandler(provider: MosaicServerProvider): RequestHandler {
  return async ({ request }) => (await provider()).app.fetch(request);
}

export function createMosaicApiHandlers(provider: MosaicServerProvider): Record<
  'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS',
  RequestHandler
> {
  const handler = createMosaicApiHandler(provider);
  return { GET: handler, POST: handler, PUT: handler, PATCH: handler, DELETE: handler, OPTIONS: handler };
}

export function normalizeMosaicRoute(pathname: string): string {
  const path = `/${pathname}`.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  return path || '/';
}

export function resolveMosaicPage(pages: PageDef[], pathname: string): PageDef | undefined {
  return matchMosaicPage(pages, pathname)?.page;
}

export interface MosaicPageMatch<T = PageDef> {
  page: T;
  params: Record<string, string>;
}

function matchRoute(pattern: string, pathname: string): Record<string, string> | undefined {
  const patternParts = normalizeMosaicRoute(pattern).split('/').filter(Boolean);
  const pathParts = normalizeMosaicRoute(pathname).split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return undefined;
  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index]!;
    const actual = pathParts[index]!;
    if (expected.startsWith(':')) {
      try {
        params[expected.slice(1)] = decodeURIComponent(actual);
      } catch {
        return undefined;
      }
    } else if (expected !== actual) return undefined;
  }
  return params;
}

export function matchMosaicPage<T extends Pick<PageDef, 'route'>>(pages: T[], pathname: string): MosaicPageMatch<T> | undefined {
  const ranked = [...pages].sort((left, right) => {
    const dynamic = (page: T) => normalizeMosaicRoute(page.route).split('/').filter((part) => part.startsWith(':')).length;
    return dynamic(left) - dynamic(right);
  });
  for (const page of ranked) {
    const params = matchRoute(page.route, pathname);
    if (params) return { page, params };
  }
  return undefined;
}

export interface MosaicRouteData {
  mosaicPage: PageDef;
  mosaicParams: Record<string, string>;
}

/** Load the published database page for any route not owned by a concrete Svelte file. */
export function createMosaicRouteLoader(options: { apiBase?: string } = {}): ServerLoad<Record<string, string>, Record<string, unknown>, MosaicRouteData> {
  const apiBase = (options.apiBase ?? '/api').replace(/\/$/, '');
  return async ({ fetch, url }) => {
    const response = await fetch(`${apiBase}/pages?published=true&includeRestrictedRoutes=true`);
    const payload = await response.json() as ApiResponse<Array<PageDef | Pick<PageDef, 'route'>>>;
    if (!response.ok || !payload.success) throw error(response.status || 503, 'Mosaic pages are unavailable');
    const match = matchMosaicPage(payload.data, url.pathname);
    if (!match) throw error(404, `No published page exists at ${url.pathname}`);
    const login = `/login?next=${encodeURIComponent(url.pathname + url.search)}`;
    if (!('root' in match.page)) throw redirect(303, login);
    if (match.page.settings?.requiresAuth) {
      const auth = await fetch(`${apiBase}/auth/me`);
      if (auth.status === 401 || auth.status === 403) {
        throw redirect(303, login);
      }
      if (!auth.ok) throw error(auth.status || 503, 'Authentication is unavailable');
    }
    return { mosaicPage: match.page, mosaicParams: match.params };
  };
}
