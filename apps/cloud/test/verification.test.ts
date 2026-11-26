import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyApp } from '../src/lib/server/mosaic-runtime';
import { autoRepair, compileSpec, normalizeSpec, validateSpec } from '../src/lib/server/spec';

test('verifying member submissions creates a fresh email and date instead of copying unique sample fields', async () => {
  const { spec } = autoRepair(normalizeSpec({
    entities: [{ name: 'member', label: 'Member', permissions: { create: ['viewer'] }, fields: [
      { name: 'email', type: 'string', format: 'email', unique: true, required: true },
      { name: 'effectiveDate', type: 'date', unique: true, required: true },
      { name: 'status', type: 'enum', options: ['Active', 'Inactive'], required: true },
    ], submission: { managed: [{ field: 'status', source: 'constant', value: 'Active' }] } }],
    sampleData: [{ entity: 'member', records: [{ email: 'test@example.com', effectiveDate: '2026-12-02', status: 'Active' }] }],
  }));
  assert.deepEqual(validateSpec(spec), []);
  assert.deepEqual(await verifyApp(spec, compileSpec(spec)), []);
});

test('a new account can book with an account-bound profile and cannot claim an existing email match', async () => {
  const { spec } = autoRepair(normalizeSpec({
    allowRegistration: true,
    entities: [
      { name: 'patient', fields: [
        { name: 'name', required: true },
        { name: 'email', format: 'email', unique: true, required: true },
        { name: 'accountId', unique: true },
      ] },
      { name: 'appointment', label: 'Appointment', permissions: { create: ['viewer'] }, fields: [
        { name: 'startsAt', type: 'datetime', required: true },
        { name: 'patient', type: 'ref', refEntity: 'patient', required: true },
      ], submission: { profile: { entity: 'patient', emailField: 'email', provision: { accountField: 'accountId', nameField: 'name' } },
        managed: [{ field: 'patient', source: 'profile', value: 'id' }] } },
    ],
    sampleData: [
      { entity: 'patient', records: [{ name: 'Example', email: 'patient@example.com' }] },
      { entity: 'appointment', records: [{ patient: 'Example', startsAt: '2026-12-02T09:30:00Z' }] },
    ],
  }));
  assert.deepEqual(validateSpec(spec), []);
  assert.deepEqual(await verifyApp(spec, compileSpec(spec)), []);

  spec.sampleData[0]!.records[0]!.find((field) => field.field === 'email')!.value = 'SUBMIT-APPOINTMENT@mosaic.local';
  assert.match((await verifyApp(spec, compileSpec(spec))).join('\n'), /Submitting Appointment failed: 403/);

  spec.entities[0]!.fields.push({ ...spec.entities[0]!.fields[0]!, name: 'membershipNumber' });
  assert.match(validateSpec(spec).join('\n'), /Membership and other required fields need a separate enrollment flow/);
});
