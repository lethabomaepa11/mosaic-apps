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

test('user organization repair follows the signed-in membership only when the source is unambiguous', () => {
  const draft = normalizeSpec({
    entities: [
      { name: 'organization', fields: [{ name: 'name' }] },
      { name: 'membership', fields: [
        { name: 'account_email', unique: true },
        { name: 'company', type: 'ref', refEntity: 'organization' },
      ] },
      { name: 'user', fields: [{ name: 'organization', type: 'ref', refEntity: 'organization' }], submission: {
        profile: { entity: 'membership', emailField: 'account_email' },
        managed: [{ field: 'organization', source: 'profile', value: 'id' }],
      } },
    ],
  });
  const repaired = autoRepair(draft).spec;
  assert.deepEqual(validateSpec(repaired), []);
  assert.deepEqual(repaired.entities[2]?.submission?.managed, [{ field: 'organization', source: 'profile', value: 'company' }]);
  assert.deepEqual(compileSpec(repaired).workflows?.[0]?.input.properties, {});

  const membership = draft.entities[1]!;
  membership.fields.push({ ...membership.fields[1]!, name: 'billingCompany' });
  assert.match(validateSpec(autoRepair(draft).spec).join('\n'), /user\.organization: invalid server-managed value/);
  membership.fields.splice(1);
  assert.match(validateSpec(autoRepair(draft).spec).join('\n'), /user\.organization: invalid server-managed value/);
});

test('RSVP membership is repaired using the unique account email on the linked member', () => {
  const draft = normalizeSpec({
    entities: [
      { name: 'member', fields: [{ name: 'name' }, { name: 'account_email', unique: true }] },
      { name: 'rsvp', fields: [{ name: 'member', type: 'ref', refEntity: 'member' }], submission: {
        managed: [{ field: 'member', source: 'userId', value: '' }],
      } },
    ],
  });
  const { spec } = autoRepair(draft);
  assert.deepEqual(validateSpec(spec), []);
  assert.deepEqual(spec.entities[1]?.submission, {
    profile: { entity: 'member', emailField: 'accountEmail' },
    managed: [{ field: 'member', source: 'profile', value: 'id' }],
    selectable: [],
  });
  draft.entities[0]!.fields.push({ ...draft.entities[0]!.fields[1]!, name: 'loginEmail' });
  assert.match(validateSpec(autoRepair(draft).spec).join('\n'), /rsvp\.member: invalid server-managed value/);
});

test('book and equipment pickers reuse catalogue access without changing private roles', () => {
  const draft = normalizeSpec({
    entities: [
      { name: 'book', fields: [{ name: 'title' }], permissions: { read: ['viewer'] } },
      { name: 'equipment', fields: [{ name: 'name' }], permissions: { read: ['viewer'] } },
      { name: 'member', fields: [{ name: 'email', unique: true }] },
      { name: 'meeting', permissions: { create: ['viewer'] }, fields: [
        { name: 'book', type: 'ref', refEntity: 'book' }, { name: 'published', type: 'boolean' },
      ], submission: { managed: [{ field: 'published', source: 'constant', value: 'false' }] } },
      { name: 'loan', permissions: { create: ['viewer'] }, fields: [
        { name: 'equipment', type: 'ref', refEntity: 'equipment' }, { name: 'borrower', type: 'ref', refEntity: 'member' },
      ], submission: { profile: { entity: 'member', emailField: 'email' }, managed: [{ field: 'borrower', source: 'profile', value: 'id' }] } },
    ],
  });
  const repaired = autoRepair(draft).spec;
  assert.deepEqual(validateSpec(repaired), []);
  assert.deepEqual(repaired.entities[3]?.submission?.selectable, ['book']);
  assert.deepEqual(repaired.entities[4]?.submission?.selectable, ['equipment']);
  assert.deepEqual(compileSpec(repaired).entities.find((entity) => entity.name === 'member')?.permissions?.read, ['admin']);
  draft.entities[0]!.permissions.read = ['admin'];
  assert.match(validateSpec(autoRepair(draft).spec).join('\n'), /meeting\.book: choose a server-managed profile link/);
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

test('generated appointment form distinguishes calendar dates from times', () => {
  const { spec } = autoRepair(normalizeSpec({ entities: [{
    name: 'appointment', fields: [{ name: 'scheduledAt', type: 'datetime' }, { name: 'followUpDate', type: 'date' }],
  }] }));
  const fields = compileSpec(spec).forms[0]?.root.children?.[0]?.children;
  assert.equal(fields?.[0]?.props?.withTime, true);
  assert.equal(fields?.[1]?.props?.withTime, undefined);
});

test('a spotlight can add home copy without duplicating the page title', () => {
  const { spec } = autoRepair(normalizeSpec({
    name: 'Clinic Manager',
    pages: [{ kind: 'home', route: '/', title: 'Welcome to Clinic Manager', access: 'public', sections: [
      { kind: 'spotlight', title: 'Welcome to Clinic Manager', body: 'Book an appointment with the clinic.' },
    ] }],
  }));
  const nodes = compileSpec(spec).pages[0]?.root.children;
  assert.equal(nodes?.[0]?.props?.text, 'Welcome to Clinic Manager');
  assert.deepEqual(nodes?.[1]?.children?.map((child) => child.props?.text), ['Book an appointment with the clinic.']);
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
