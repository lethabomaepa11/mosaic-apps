import assert from 'node:assert/strict';
import test from 'node:test';
import type { PageDef } from '@mosaic-apps/core';
import { createMosaicServerProvider, normalizeMosaicRoute, resolveMosaicPage } from './index.js';

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
