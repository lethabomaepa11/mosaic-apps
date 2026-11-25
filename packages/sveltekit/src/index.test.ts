import assert from 'node:assert/strict';
import test from 'node:test';
import type { PageDef } from '@mosaic-apps/core';
import {
  createMosaicRouteLoader,
  createMosaicServerProvider,
  matchMosaicPage,
  normalizeMosaicRoute,
  resolveMosaicPage,
} from './index.js';

const page = (route: string): PageDef => ({
  id: route, slug: route === '/' ? 'home' : route.slice(1), name: route, route,
  version: 1, published: true, root: { id: 'root', type: 'page', children: [] },
});

test('normalizes application routes and resolves exact published pages', () => {
  const pages = [page('/'), page('/customers')];
  assert.equal(normalizeMosaicRoute('//customers/'), '/customers');
  assert.equal(resolveMosaicPage(pages, '/customers/')?.route, '/customers');
  assert.equal(resolveMosaicPage(pages, '/customer'), undefined);
});

test('prefers exact routes and extracts dynamic route parameters', () => {
  const pages = [page('/customers/:id'), page('/customers/new')];
  assert.equal(matchMosaicPage(pages, '/customers/new')?.page.route, '/customers/new');
  assert.deepEqual(matchMosaicPage(pages, '/customers/cust%201'), {
    page: pages[0],
    params: { id: 'cust 1' },
  });
  assert.equal(matchMosaicPage(pages, '/customers/%E0%A4%A'), undefined);
  assert.equal(matchMosaicPage(pages, '/customers/one/details'), undefined);
});

test('server provider initializes once for concurrent requests', async () => {
  let calls = 0;
  const expected = { app: {} } as never;
  const provider = createMosaicServerProvider(async () => {
    calls += 1;
    return expected;
  });
  const [first, second] = await Promise.all([provider(), provider()]);
  assert.equal(first, expected);
  assert.equal(second, expected);
  assert.equal(calls, 1);
});

test('route loader returns dynamic params after a successful access check', async () => {
  const protectedPage = { ...page('/customers/:id'), settings: { requiresAuth: true } };
  const load = createMosaicRouteLoader();
  const result = await load({
    url: new URL('https://example.test/customers/cust%201'),
    fetch: async (input: RequestInfo | URL) => String(input).includes('/auth/me')
      ? new Response(JSON.stringify({ success: true, data: { id: 'user_1' } }))
      : new Response(JSON.stringify({ success: true, data: [protectedPage] })),
  } as never);
  assert.deepEqual(result, { mosaicPage: protectedPage, mosaicParams: { id: 'cust 1' } });
});

test('route loader sends anonymous users to login with a safe return path', async () => {
  const protectedPage = { ...page('/account'), settings: { requiresAuth: true } };
  const load = createMosaicRouteLoader();
  await assert.rejects(
    () => load({
      url: new URL('https://example.test/account?tab=billing'),
      fetch: async (input: RequestInfo | URL) => String(input).includes('/auth/me')
        ? new Response(null, { status: 401 })
        : new Response(JSON.stringify({ success: true, data: [protectedPage] })),
    } as never),
    (cause: unknown) => {
      const redirect = cause as { status?: number; location?: string };
      return redirect.status === 303 && redirect.location === '/login?next=%2Faccount%3Ftab%3Dbilling';
    },
  );
});

test('a protected exact route redirects before a matching public dynamic route', async () => {
  const load = createMosaicRouteLoader();
  await assert.rejects(
    () => load({
      url: new URL('https://example.test/customers/private'),
      fetch: async (input: RequestInfo | URL) => {
        assert.equal(String(input), '/api/pages?published=true&includeRestrictedRoutes=true');
        return new Response(JSON.stringify({ success: true, data: [page('/customers/:id'), { route: '/customers/private' }] }));
      },
    } as never),
    (cause: unknown) => (cause as { location?: string }).location === '/login?next=%2Fcustomers%2Fprivate',
  );
});
