import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPageRoute, matchPageRoute, pageRouteSpecificity, validatePageRoute } from './routing.js';

test('metadata page routes match safe named parameters and prefer static paths', () => {
  assert.deepEqual(matchPageRoute('/orders/:id', '/orders/first%20order'), { id: 'first order' });
  assert.equal(matchPageRoute('/orders/:id', '/orders'), null);
  assert.equal(matchPageRoute('/orders/:id', '/orders/a%2Fb'), null);
  assert.equal(matchPageRoute('/orders/:id', '/orders/%ZZ'), null);
  assert.equal(matchPageRoute('/orders/:id', '/orders/..'), null);
  assert.ok(pageRouteSpecificity('/orders/new') > pageRouteSpecificity('/orders/:id'));
});

test('navigation builds routes without unsafe paths or missing parameters', () => {
  assert.equal(buildPageRoute('/orders/:id', { id: 'first order' }), '/orders/first%20order');
  assert.throws(() => buildPageRoute('/orders/:id'), /route parameter id/);
  for (const route of ['//evil.test', '/orders/../secret', '/orders/:id/:id', '/orders/*', '/orders?x=1', '/orders/']) assert.throws(() => validatePageRoute(route));
  assert.throws(() => buildPageRoute('/orders/:id', { id: '../secret' }), /Invalid value/);
  assert.equal(validatePageRoute('/'), '/');
});
