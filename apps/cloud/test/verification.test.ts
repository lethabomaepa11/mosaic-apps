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
