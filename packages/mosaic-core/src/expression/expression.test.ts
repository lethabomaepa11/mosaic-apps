import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { evaluateBoolean, evaluateExpression, tryEvaluate } from './index.js';

test('arithmetic and precedence', () => {
  assert.equal(evaluateExpression('2 + 3 * 4', {}), 14);
  assert.equal(evaluateExpression('(2 + 3) * 4', {}), 20);
  assert.equal(evaluateExpression('-x + 10', { x: 4 }), 6);
});

test('member access and comparisons on scope', () => {
  const scope = { order: { total: 120, customer: { tier: 'gold' } } };
  assert.equal(evaluateExpression('order.total > 100', scope), true);
  assert.equal(evaluateExpression('order.customer.tier === "gold"', scope), true);
  assert.equal(evaluateExpression('order.missing ?? 7', scope), 7);
  assert.equal(evaluateExpression('order.missing.deep ?? "ok"', scope), 'ok');
});

test('ternary, logical, nullish', () => {
  const scope = { a: 5, b: null as unknown };
  assert.equal(evaluateExpression('a > 3 ? "big" : "small"', scope), 'big');
  assert.equal(evaluateExpression('b ?? "fallback"', scope), 'fallback');
  assert.equal(evaluateExpression('a && a * 2', scope), 10);
  assert.equal(evaluateExpression('!b', scope), true);
});

test('string methods whitelisted, dangerous members blocked', () => {
  assert.equal(evaluateExpression('name.startsWith("jo")', { name: 'jonas' }), true);
  assert.equal(evaluateExpression('name.toLowerCase()', { name: 'JONAS' }), 'jonas');
  assert.equal(evaluateExpression('name.length', { name: 'abcd' }), 4);
  const evil = tryEvaluate('obj.constructor', { obj: {} });
  assert.equal(evil.ok, false);
  const evil2 = tryEvaluate('obj["__proto__"]', { obj: {} });
  assert.equal(evil2.ok, true);
  assert.equal(evil2.value, undefined);
  const evil3 = tryEvaluate('unknownFn()', {});
  assert.equal(evil3.ok, false);
});

test('array literals and includes', () => {
  assert.equal(evaluateExpression('list.includes("b")', { list: ['a', 'b'] }), true);
  assert.equal(evaluateExpression('[1, 2, 3].includes(v)', { v: 2 }), true);
  assert.throws(() => evaluateExpression('"b" in list', { list: ['a', 'b'] }));
});

test('tryEvaluate fails soft with message', () => {
  const res = tryEvaluate('2 +', {});
  assert.equal(res.ok, false);
  assert.match(String(res.error), /Expression error|Unexpected/);
});

test('evaluateBoolean fails open by default', () => {
  assert.equal(evaluateBoolean('a === broken(', { a: 1 }), true);
  assert.equal(evaluateBoolean('a === 1', { a: 1 }), true);
  assert.equal(evaluateBoolean('a === 2', { a: 1 }), false);
});

test('math statics', () => {
  assert.equal(evaluateExpression('Math.round(2.6)', {}), 3);
  assert.equal(evaluateExpression('Math.max(a, b)', { a: 3, b: 9 }), 9);
});
