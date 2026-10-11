import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { emptyQuery, type EntityDef, type QuerySpec } from '@mosaic/core';
import { buildInsertSql, buildListSql, buildUpdateSql, buildWhere, countParams, QueryError } from './sql.js';

const entity: EntityDef = {
  name: 'customer',
  softDelete: true,
  list: { defaultSort: 'name' },
  fields: [
    { name: 'name', type: 'string', required: true, searchable: true },
    { name: 'status', type: 'enum', options: ['active', 'churned'] },
    { name: 'age', type: 'int' },
    { name: 'owner', type: 'ref', refEntity: 'employee' },
    { name: 'internal', type: 'string', filterable: false, sortable: false },
  ],
};

function spec(patch: Partial<QuerySpec> = {}): QuerySpec {
  return { ...emptyQuery(), ...patch };
}

test('soft delete adds IS NULL guard unless included', () => {
  const a = buildWhere(entity, spec(), {});
  assert.match(a.clause, /"deletedAt" IS NULL/);
  const b = buildWhere(entity, spec(), { includeDeleted: true });
  assert.doesNotMatch(b.clause, /deletedAt/);
});

test('filters build parameterised SQL with casts', () => {
  const { clause, params } = buildWhere(
    entity,
    spec({
      filters: [
        { field: 'name', op: 'contains', value: 'mi' },
        { field: 'age', op: 'gte', value: '30' },
        { field: 'status', op: 'in', values: ['active', 'churned'] },
        { field: 'owner', op: 'isNull' },
      ],
    }),
    {},
  );
  assert.match(clause, /"t"\."name" ILIKE \$1/);
  assert.match(clause, /"t"\."age" >= \$2::int/);
  assert.match(clause, /"t"\."status" IN \(\$3, \$4\)/);
  assert.match(clause, /"t"\."owner" IS NULL/);
  assert.deepEqual(params, ['%mi%', 30, 'active', 'churned']);
});

test('unknown or non-filterable fields raise QueryError', () => {
  assert.throws(() => buildWhere(entity, spec({ filters: [{ field: 'nope', op: 'eq', value: 1 }] }), {}), QueryError);
  assert.throws(() => buildWhere(entity, spec({ filters: [{ field: 'internal', op: 'eq', value: 'x' }] }), {}), QueryError);
});

test('q searches searchable fields as OR group', () => {
  const { clause, params } = buildWhere(entity, spec({ q: 'ann' }), {});
  assert.match(clause, /"t"\."name"::text ILIKE \$\d+/);
  assert.ok(params.some((p) => String(p).includes('ann')));
});

test('buildListSql orders by default and appends limit/offset', () => {
  const built = buildListSql(entity, spec({ sort: [{ field: 'name', dir: 'desc' }], page: 3, pageSize: 25 }), {});
  assert.match(built.sql, /ORDER BY "t"\."name" DESC/);
  assert.match(built.sql, /LIMIT \$\d+ OFFSET \$\d+/);
  const tail = built.params.slice(-2);
  assert.deepEqual(tail, [25, 50]);
  assert.equal(countParams(built.params).length, built.params.length - 2);
  assert.match(built.countSql, /count\(\*\)::int/);
});

test('include joins label for ref fields', () => {
  const built = buildListSql(
    entity,
    spec({ include: ['owner'] }),
    { resolveEntity: () => ({ name: 'employee', fields: [{ name: 'fullName', type: 'string' }] }) },
  );
  assert.match(built.sql, /LEFT JOIN "employee" j0/);
  assert.match(built.sql, /"fullName" AS "owner_label"/);
});

test('insert only allows writable entity fields', () => {
  const { sql, params } = buildInsertSql(entity, { name: 'A', evil: 1, age: 4 });
  assert.match(sql, /INSERT INTO "customer" \("name", "age"\)/);
  assert.deepEqual(params, ['A', 4]);
  assert.ok(!sql.includes('evil'));
});

test('update always bumps updatedAt and excludes id', () => {
  const { sql, params } = buildUpdateSql(entity, 'abc', { name: 'B', id: 'hax' });
  assert.match(sql, /SET "name" = \$1, "updatedAt" = now\(\) WHERE "id" = \$2/);
  assert.deepEqual(params, ['B', 'abc']);
});
