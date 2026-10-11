import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildQueryString, parseQuery } from './query.js';

test('defaults', () => {
  const q = parseQuery({});
  assert.deepEqual(q, { page: 1, pageSize: 20, sort: [], filters: [] });
});

test('paging clamps to bounds', () => {
  assert.equal(parseQuery({ page: '-3' }).page, 1);
  assert.equal(parseQuery({ pageSize: '9999' }).pageSize, 200);
  assert.equal(parseQuery({ pageSize: '0' }).pageSize, 1);
  assert.equal(parseQuery({ page: 'abc' }).page, 1);
});

test('sort parsing with direction and default sort', () => {
  const q = parseQuery({ sort: 'name,-createdAt' });
  assert.deepEqual(q.sort, [
    { field: 'name', dir: 'asc' },
    { field: 'createdAt', dir: 'desc' },
  ]);
  assert.deepEqual(parseQuery({}, { defaultSort: 'name' }).sort, [{ field: 'name', dir: 'asc' }]);
});

test('json filter param', () => {
  const q = parseQuery({ filter: JSON.stringify([{ field: 'age', op: 'gt', value: 30 }]) });
  assert.deepEqual(q.filters, [{ field: 'age', op: 'gt', value: 30 }]);
});

test('where shorthand: field:op:value and bare eq', () => {
  const q = parseQuery({ where: ['age:gt:30', 'city:Berlin'] });
  assert.deepEqual(q.filters, [
    { field: 'age', op: 'gt', value: '30' },
    { field: 'city', op: 'eq', value: 'Berlin' },
  ]);
});

test('in / between expand values', () => {
  const q = parseQuery({ where: ['status:in:active,prospect', 'total:between:10,99'] });
  assert.deepEqual(q.filters[0], { field: 'status', op: 'in', values: ['active', 'prospect'] });
  assert.deepEqual(q.filters[1], { field: 'total', op: 'between', values: ['10', '99'] });
});

test('unknown ops and bad fields are dropped', () => {
  const q = parseQuery({ where: ['age:wat:1', '1bad:2'], filter: JSON.stringify([{ field: 'x;', op: 'eq', value: 1 }]) });
  assert.equal(q.filters.length, 0);
});

test('q / select / include round trip', () => {
  const spec = parseQuery({ q: ' helm ', select: 'name,price,1bad', include: 'customer' });
  assert.equal(spec.q, 'helm');
  assert.deepEqual(spec.select, ['name', 'price']);
  assert.deepEqual(spec.include, ['customer']);
  const qs = buildQueryString(spec);
  const back = parseQuery(Object.fromEntries(new URLSearchParams(qs)));
  assert.equal(back.q, 'helm');
  assert.deepEqual(back.select, ['name', 'price']);
});
