import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { EntityDef } from '@mosaic-apps/core';
import { buildEntitySchema, formatIssues } from './zod.js';

const entity: EntityDef = {
  name: 'customer',
  fields: [
    { name: 'name', type: 'string', required: true, minLength: 2 },
    { name: 'email', type: 'string', format: 'email' },
    { name: 'age', type: 'int', min: 0, max: 150 },
    { name: 'active', type: 'boolean', default: true },
    { name: 'status', type: 'enum', options: ['a', 'b'], default: 'a' },
    { name: 'joined', type: 'date' },
    { name: 'meta', type: 'json' },
  ],
};

test('create mode enforces required fields', () => {
  const schema = buildEntitySchema(entity, 'create');
  const res = schema.safeParse({ email: 'x@y.io' });
  assert.equal(res.success, false);
  if (!res.success) {
    const issues = formatIssues(res.error);
    assert.ok(issues.some((i) => i.path === 'name'));
  }
});

test('valid payload passes and unknown keys are stripped', () => {
  const schema = buildEntitySchema(entity, 'create');
  const res = schema.safeParse({
    name: 'Jane',
    email: 'jane@doe.com',
    age: '42',
    active: 'false',
    status: 'b',
    joined: '2024-05-01',
    meta: { any: true },
    injected: 'boom',
  });
  assert.equal(res.success, true);
  if (res.success) {
    const data = res.data as Record<string, unknown>;
    assert.equal(data.name, 'Jane');
    assert.equal(data.age, 42);
    assert.equal(data.active, false);
    assert.ok(!('injected' in data));
  }
});

test('validation failures carry paths and messages', () => {
  const schema = buildEntitySchema(entity, 'create');
  const res = schema.safeParse({ name: 'J', email: 'nope', age: -1, status: 'z', joined: '01/02/2020' });
  assert.equal(res.success, false);
  if (!res.success) {
    const issues = formatIssues(res.error);
    const paths = issues.map((i) => i.path);
    assert.ok(paths.includes('name'));
    assert.ok(paths.includes('email'));
    assert.ok(paths.includes('age'));
    assert.ok(paths.includes('status'));
    assert.ok(paths.includes('joined'));
  }
});

test('update mode makes everything optional', () => {
  const schema = buildEntitySchema(entity, 'update');
  assert.equal(schema.safeParse({}).success, true);
  assert.equal(schema.safeParse({ age: 3 }).success, true);
  assert.equal(schema.safeParse({ status: 'zzz' }).success, false);
});

