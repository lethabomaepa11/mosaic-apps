import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { EntityDef } from '@mosaic-apps/core';
import { emptyTable, type SchemaSnapshot } from '../db/introspect.js';
import { checksumStatements, diffEntities, diffEntity } from './engine.js';

const base: EntityDef = {
  name: 'customer',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'status', type: 'enum', options: ['active', 'churned'], default: 'active' },
    { name: 'email', type: 'string', unique: true },
    { name: 'owner', type: 'ref', refEntity: 'employee', onDelete: 'set null' },
    { name: 'score', type: 'int', indexed: true },
  ],
  softDelete: true,
};

function snapshot(tables: Record<string, ReturnType<typeof emptyTable>>): SchemaSnapshot {
  return tables;
}

test('new entity plans CREATE TABLE with system columns, then constraints', () => {
  const employee: EntityDef = { name: 'employee', fields: [{ name: 'fullName', type: 'string', required: true }] };
  const res = diffEntities([employee, base], {});
  assert.equal(res.plans.length, 2);
  const plan = res.plans.find((p) => p.entity === 'customer')!;
  const kinds = plan.statements.map((s) => s.kind);
  assert.equal(kinds[0], 'create-table');
  const create = plan.statements[0]!;
  assert.match(create.sql, /CREATE TABLE "customer"/);
  assert.match(create.sql, /"id" uuid NOT NULL DEFAULT gen_random_uuid\(\)/);
  assert.match(create.sql, /"createdAt" timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(create.sql, /"deletedAt" timestamptz/);
  assert.match(create.sql, /"name" varchar\(255\) NOT NULL/);
  assert.match(create.sql, /CONSTRAINT "customer_pkey" PRIMARY KEY \("id"\)/);
  assert.ok(kinds.includes('add-constraint'));
  const unique = plan.statements.find((s) => s.sql.includes('UNIQUE ("email")'));
  assert.ok(unique, 'unique constraint planned');
  const fk = plan.statements.find((s) => s.sql.includes('FOREIGN KEY ("owner")'));
  assert.ok(fk, 'fk planned');
  assert.match(fk!.sql, /ON DELETE SET NULL/);
  const check = plan.statements.find((s) => s.sql.includes('customer_status_enum_check'));
  assert.ok(check, 'enum check planned');
  const idx = plan.statements.find((s) => s.kind === 'create-index');
  assert.ok(idx, 'index planned');
  assert.match(idx!.sql, /CREATE INDEX "customer_score_idx"/);
});

test('missing ref target warns but still plans the rest', () => {
  const entity: EntityDef = {
    name: 'order',
    fields: [{ name: 'customer', type: 'ref', refEntity: 'customer', required: true }],
  };
  const res = diffEntities([entity], {});
  assert.ok(res.warnings.some((w) => w.includes('customer')), 'warns about missing target');
  assert.equal(res.plans[0]!.statements[0]!.kind, 'create-table');
  assert.ok(
    !res.plans[0]!.statements.some((s) => s.sql.includes('FOREIGN KEY')),
    'FK to missing target is not planned',
  );
});

test('converged schema produces an empty plan', () => {
  const table = emptyTable('customer');
  table.exists = true;
  for (const col of ['id', 'name', 'status', 'email', 'owner', 'score', 'createdAt', 'updatedAt', 'deletedAt']) {
    table.columns[col] = {
      name: col,
      dataType:
        col === 'name' || col === 'email'
          ? 'character varying'
          : col === 'score'
            ? 'integer'
            : col === 'id' || col === 'owner'
              ? 'uuid'
              : col === 'createdAt' || col === 'updatedAt' || col === 'deletedAt'
                ? 'timestamp with time zone'
                : 'text',
      udtName: 'x',
      nullable: !['id', 'name', 'createdAt', 'updatedAt'].includes(col),
      default:
        col === 'id'
          ? 'gen_random_uuid()'
          : col === 'createdAt' || col === 'updatedAt'
            ? 'now()'
            : col === 'status'
              ? "'active'::text"
              : null,
      maxLength: col === 'name' || col === 'email' ? 255 : null,
      precision: null,
      scale: null,
    };
  }
  table.primaryKey = ['id'];
  table.uniques.push({ name: 'customer_email_key', columns: ['email'] });
  table.checks.push({
    name: 'customer_status_enum_check',
    columns: ['status'],
    definition: "CHECK ((status = ANY (ARRAY['active'::text, 'churned'::text])))",
  });
  table.foreignKeys.push({
    name: 'customer_owner_fkey',
    columns: ['owner'],
    refTable: 'employee',
    refColumns: ['id'],
    onDelete: 'set null',
  });
  table.indexes.push({ name: 'customer_score_idx', columns: ['score'], unique: false });

  const phases = diffEntity(base, table);
  assert.deepEqual({ a: phases.a, b: phases.b, c: phases.c }, { a: [], b: [], c: [] }, 'no drift => no statements');
  assert.deepEqual(phases.warnings, []);
});

test('added field plans ADD COLUMN; removed known column plans destructive DROP', () => {
  const table = emptyTable('customer');
  table.exists = true;
  table.columns['name'] = {
    name: 'name',
    dataType: 'character varying',
    udtName: 'varchar',
    nullable: false,
    default: null,
    maxLength: 255,
    precision: null,
    scale: null,
  };
  table.columns['legacy'] = {
    name: 'legacy',
    dataType: 'text',
    udtName: 'text',
    nullable: true,
    default: null,
    maxLength: null,
    precision: null,
    scale: null,
  };
  const phases = diffEntity(base, table, {
    knownColumns: new Map([['customer', new Set(['name', 'legacy'])]]),
  });
  const adds = phases.a.filter((s) => s.kind === 'add-column');
  assert.ok(adds.some((s) => s.sql.includes('"status"')), 'adds status');
  const drop = phases.b.find((s) => s.kind === 'drop-column');
  assert.ok(drop, 'drops legacy');
  assert.equal(drop!.risk, 'destructive');
  assert.match(drop!.sql, /DROP COLUMN "legacy"/);
});

test('unmanaged extra column is left alone with a warning', () => {
  const table = emptyTable('customer');
  table.exists = true;
  table.columns['hand_made'] = {
    name: 'hand_made',
    dataType: 'text',
    udtName: 'text',
    nullable: true,
    default: null,
    maxLength: null,
    precision: null,
    scale: null,
  };
  const phases = diffEntity(base, table);
  assert.equal(phases.b.length, 0);
  assert.ok(phases.warnings.some((w) => w.includes('hand_made')));
});

test('enum option change refreshes the check constraint', () => {
  const table = emptyTable('customer');
  table.exists = true;
  table.columns['status'] = {
    name: 'status',
    dataType: 'text',
    udtName: 'text',
    nullable: true,
    default: null,
    maxLength: null,
    precision: null,
    scale: null,
  };
  table.checks.push({
    name: 'customer_status_enum_check',
    columns: ['status'],
    definition: "CHECK ((status = ANY (ARRAY['old'::text])))",
  });
  const phases = diffEntity(base, table);
  assert.ok(phases.b.some((s) => s.sql.includes('DROP CONSTRAINT "customer_status_enum_check"')));
  assert.ok(phases.c.some((s) => s.sql.includes("'active'") && s.sql.includes("'churned'")));
});

test('checksum is deterministic', () => {
  const a = diffEntities([base], {}).plans[0]!.statements;
  const b = diffEntities([base], {}).plans[0]!.statements;
  assert.equal(checksumStatements(a), checksumStatements(b));
});

