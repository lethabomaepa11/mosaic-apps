import assert from 'node:assert/strict';
import test from 'node:test';
import { autoRepair, compileSpec, normalizeSpec, validateSpec } from '../src/lib/server/spec';
import { equipmentSpec } from './fixtures/equipment-spec';

test('mistakes seen in real generations are repaired without an AI round', () => {
  const broken = structuredClone(equipmentSpec);
  broken.entities[1]!.fields[1]!.name = 'serial_number';                 // snake_case field
  broken.entities[1]!.fields.push({ ...broken.entities[1]!.fields[0]!, name: 'createdAt' }); // system column
  broken.entities[0]!.name = 'Employee';                                  // not snake_case
  broken.entities[2]!.fields[2]!.refEntity = 'Employee';
  broken.pages = broken.pages.filter((page) => page.entity !== 'employee'); // missing list page
  broken.sampleData[1]!.records[0]![1]!.field = 'serial_number';
  assert.ok(validateSpec(broken).length > 0);

  const { spec, repairs } = autoRepair(broken);
  assert.deepEqual(validateSpec(spec), []);
  assert.ok(repairs.length >= 3);
  assert.equal(spec.entities[1]!.fields[1]!.name, 'serialNumber');
  assert.ok(!spec.entities[1]!.fields.some((field) => field.name === 'createdAt'));
  assert.ok(spec.pages.some((page) => page.kind === 'list' && page.entity === 'employee'));
  assert.equal(spec.sampleData[1]!.records[0]![1]!.field, 'serialNumber', 'sample data follows renamed fields');
});

test('a link to an entity that does not exist becomes a text field instead of failing', () => {
  const broken = structuredClone(equipmentSpec);
  broken.entities[2]!.fields[1]!.refEntity = 'warehouse';
  const { spec } = autoRepair(broken);
  assert.equal(spec.entities[2]!.fields[1]!.type, 'string');
  assert.deepEqual(validateSpec(spec), []);
});

test('sample records are understood in every shape models produce', () => {
  const shapes = [
    [{ fullName: 'Thandi Nkosi', email: 't@example.com' }],                                  // record objects (asked for)
    [[{ field: 'fullName', value: 'Thandi Nkosi' }, { field: 'email', value: 't@example.com' }]], // pair arrays
    [{ field: 'fullName', value: 'Thandi Nkosi' }, { field: 'email', value: 't@example.com' }],   // flat pairs = one record
  ];
  for (const records of shapes) {
    const spec = normalizeSpec({ ...equipmentSpec, sampleData: [{ entity: 'employee', records }] });
    assert.deepEqual(spec.sampleData[0]!.records, [[{ field: 'fullName', value: 'Thandi Nkosi' }, { field: 'email', value: 't@example.com' }]]);
  }
});

test('missing keys and nulls from a drifted answer are filled with safe defaults', () => {
  const spec = normalizeSpec({ name: 'X', entities: [{ name: 'item', fields: [{ name: 'title', type: 'string' }, { name: 'kind', type: 'weird' }] }], pages: [{ route: '/items', kind: 'list', entity: 'item' }] });
  assert.equal(spec.entities[0]!.fields[1]!.type, 'string');
  assert.equal(spec.entities[0]!.labelField, 'title');
  assert.deepEqual(spec.entities[0]!.permissions, { read: [], create: [], update: [], delete: [] });
  assert.equal(spec.pages[0]!.access, 'authenticated');
  assert.deepEqual(validateSpec(autoRepair(spec).spec), []);
});

test('workflow pages compile domain-specific records and form actions and keep sign-up opt-in', () => {
  const draft = structuredClone(equipmentSpec);
  const workflow = draft.pages[1]!;
  workflow.kind = 'workflow';
  workflow.sections = [
    { kind: 'records', title: 'Equipment to return', body: '', entity: 'loan' },
    { kind: 'form', title: 'Lend equipment', body: 'Choose what to lend and who will borrow it.', entity: 'Loan' },
  ];
  const { spec } = autoRepair(normalizeSpec(draft));
  assert.deepEqual(validateSpec(spec), []);
  assert.equal(spec.allowRegistration, false);
  const page = compileSpec(spec).pages.find((page) => page.slug === workflow.slug)!;
  assert.equal(page.root.children?.find((node) => node.type === 'entityTable')?.props?.title, 'Equipment to return');
  const action = page.root.children?.find((node) => node.type === 'card')?.children?.find((node) => node.type === 'button');
  assert.deepEqual(action?.props?.events, { onclick: [{ type: 'navigate', target: 'form', to: 'loan-form' }] });
  spec.pages[1]!.access = 'public';
  assert.ok(validateSpec(spec).some((issue) => issue.includes('require sign-in')));
});
