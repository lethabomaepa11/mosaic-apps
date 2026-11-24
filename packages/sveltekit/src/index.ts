import { error, type RequestHandler, type ServerLoad } from '@sveltejs/kit';
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
  const route = normalizeMosaicRoute(pathname);
  return pages.find((page) => normalizeMosaicRoute(page.route) === route);
}

export interface MosaicRouteData {
  mosaicPage: PageDef;
}

/** Load the published database page for any route not owned by a concrete Svelte file. */
export function createMosaicRouteLoader(options: { apiBase?: string } = {}): ServerLoad<Record<string, string>, Record<string, unknown>, MosaicRouteData> {
  const apiBase = (options.apiBase ?? '/api').replace(/\/$/, '');
  return async ({ fetch, url }) => {
    const response = await fetch(`${apiBase}/pages?published=true`);
    const payload = await response.json() as ApiResponse<PageDef[]>;
    if (!response.ok || !payload.success) throw error(response.status || 503, 'Mosaic pages are unavailable');
    const mosaicPage = resolveMosaicPage(payload.data, url.pathname);
    if (!mosaicPage) throw error(404, `No published page exists at ${url.pathname}`);
    return { mosaicPage };
  };
}
