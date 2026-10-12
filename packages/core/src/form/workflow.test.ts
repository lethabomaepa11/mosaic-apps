import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerEntity } from '../entity/defaults.js';
import { generateEntityWorkflow } from './workflow.js';

test('generates linked table, create, edit and read-only detail definitions', () => {
  const result = generateEntityWorkflow(customerEntity);
  assert.equal(result.page.root.children?.[0]?.props?.createFormId, result.forms.create.id);
  assert.equal(result.page.root.children?.[0]?.props?.editFormId, result.forms.edit.id);
  assert.equal(result.page.root.children?.[0]?.props?.detailFormId, result.forms.detail.id);
  assert.equal(result.forms.detail.settings?.mode, 'view');
  assert.deepEqual(result.forms.edit.dataSource, { kind: 'entity', entity: 'customer', recordId: '$query.id' });
  assert.equal(result.page.settings?.requiresAuth, true);
  assert.equal(result.forms.create.settings?.redirectAfterSubmit, `/p/${result.page.slug}`);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('preserves validation, relation choices, enums and business defaults', () => {
  const result = generateEntityWorkflow(customerEntity);
  const fields = result.forms.create.root.children!;
  const name = fields.find((node) => node.props?.binding === 'name')!;
  assert.equal(name.props?.required, true);
  assert.equal(name.props?.maxLength, 160);
  assert.equal(fields.find((node) => node.props?.binding === 'owner')?.type, 'refSelect');
  assert.equal(fields.find((node) => node.props?.binding === 'owner')?.props?.entity, 'employee');
  assert.equal(fields.find((node) => node.props?.binding === 'status')?.props?.default, 'prospect');
  assert.equal(fields.find((node) => node.props?.binding === 'status')?.type, 'selectField');
  assert.ok(!fields.some((node) => node.props?.binding === 'id'));
});

test('custom columns and fields remain editable and required fields cannot be lost', () => {
  const result = generateEntityWorkflow(customerEntity, { name: 'Client accounts', columns: ['name', 'email'], fields: ['name', 'email'], pageSize: 25 });
  assert.deepEqual(result.page.root.children?.[0]?.props?.columns, ['name', 'email']);
  assert.equal(result.page.slug, 'client-accounts');
  assert.equal(result.forms.create.root.children?.filter((node) => node.props?.binding).length, 2);
  assert.throws(() => generateEntityWorkflow(customerEntity, { fields: ['email'] }), /Required field/);
  assert.throws(() => generateEntityWorkflow(customerEntity, { columns: ['unknown'] }), /available entity/);
  assert.throws(() => generateEntityWorkflow(customerEntity, { pageSize: NaN }), /Page size/);
  assert.throws(() => generateEntityWorkflow({ ...customerEntity, fields: customerEntity.fields.map(field => field.name === 'name' ? { ...field, ui: { hidden: true } } : field) }), /Required field/);
});
