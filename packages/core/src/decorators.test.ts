import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Entity,
  Field,
  Relation,
  extractEntityDef,
  humanize,
  loadEntityDefs,
  snakeCase,
} from './decorators.js';

class Timestamped {
  @Field({ type: 'string', searchable: true })
  code!: string;
}

@Entity({ name: 'employee', label: 'Employee' })
class Employee {
  @Field({ type: 'string', required: true })
  name!: string;
}

@Entity({ name: 'customer', label: 'Customer', labelPlural: 'Customers', softDelete: true, icon: 'building' })
class Customer extends Timestamped {
  @Field({ type: 'id' })
  id!: string;

  @Field({ type: 'string', required: true, searchable: true, maxLength: 160 })
  name!: string;

  @Field({ type: 'enum', options: ['prospect', 'active'], default: 'prospect' })
  status!: string;

  @Field({ type: 'json' })
  meta?: unknown;

  @Relation({ entity: () => Employee, required: true })
  owner?: string;
}

@Entity()
class OrderItem {
  @Field({ type: 'int', required: true })
  quantity!: number;
}

class NotAnEntity {
  @Field({ type: 'string' })
  name!: string;
}

test('extracts an entity definition from a decorated class', () => {
  const def = extractEntityDef(Customer);
  assert.equal(def.name, 'customer');
  assert.equal(def.label, 'Customer');
  assert.equal(def.labelPlural, 'Customers');
  assert.equal(def.softDelete, true);
  assert.equal(def.icon, 'building');

  const names = def.fields.map((f) => f.name);
  assert.deepEqual(names, ['code', 'name', 'status', 'meta', 'owner']);
  assert.ok(!names.includes('id'), 'system columns are not user fields');

  const name = def.fields.find((f) => f.name === 'name')!;
  assert.equal(name.type, 'string');
  assert.equal(name.required, true);
  assert.equal(name.maxLength, 160);
  assert.equal(name.label, 'Name');

  const status = def.fields.find((f) => f.name === 'status')!;
  assert.deepEqual(status.options, ['prospect', 'active']);
  assert.equal(status.default, 'prospect');
});

test('inherits fields from undecorated base classes', () => {
  const def = extractEntityDef(Customer);
  const code = def.fields.find((f) => f.name === 'code');
  assert.ok(code, 'base class field is inherited');
  assert.equal(code.searchable, true);
});

test('resolves Relation thunks to the target entity name', () => {
  const def = extractEntityDef(Customer);
  const owner = def.fields.find((f) => f.name === 'owner')!;
  assert.equal(owner.type, 'ref');
  assert.equal(owner.refEntity, 'employee');
  assert.equal(owner.onDelete, 'restrict');
  assert.equal(owner.required, true);
});

test('derives name, label and plural from the class name', () => {
  const def = extractEntityDef(OrderItem);
  assert.equal(def.name, 'order_item');
  assert.equal(def.label, 'Order Item');
  assert.equal(def.labelPlural, 'Order Items');
  assert.deepEqual(
    def.fields.map((f) => [f.name, f.type, f.label]),
    [['quantity', 'int', 'Quantity']],
  );
});

test('rejects classes without @Entity()', () => {
  assert.throws(() => extractEntityDef(NotAnEntity as never), /missing @Entity/);
});

test('rejects invalid definitions with the class name in the message', () => {
  @Entity()
  class Broken {
    @Field({ type: 'enum' })
    state!: string;
  }
  assert.throws(() => extractEntityDef(Broken), /Broken[\s\S]*needs options/);
});

test('snakeCase and humanize', () => {
  assert.equal(snakeCase('OrderItem'), 'order_item');
  assert.equal(snakeCase('Customer'), 'customer');
  assert.equal(snakeCase('HTTPToken'), 'http_token');
  assert.equal(humanize('order_item'), 'Order item');
  assert.equal(humanize('OrderItem'), 'Order Item');
});

test('loads JSON entity files alongside classes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mosaic-entities-'));
  try {
    await writeFile(
      join(dir, 'invoice.entity.json'),
      JSON.stringify({
        name: 'invoice',
        label: 'Invoice',
        fields: [{ name: 'total', label: 'Total', type: 'decimal', required: true }],
      }),
      'utf8',
    );
    const defs = await loadEntityDefs(dir);
    assert.deepEqual(
      defs.map((d) => d.name),
      ['invoice'],
    );
    assert.equal(defs[0]!.fields[0]!.type, 'decimal');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
