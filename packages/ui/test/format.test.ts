import assert from 'node:assert/strict';
import test from 'node:test';
import type { FieldDef } from '@mosaic-apps/core';
import { datetimeFromInput, formatCell, localDatetimeValue, refIncludes } from '../src/lib/format.js';

const owner: FieldDef = { name: 'owner', type: 'ref', refEntity: 'employee' };
const status: FieldDef = { name: 'status', type: 'enum', options: [{ value: 'active', label: 'Active' }, 'churned'] };

test('refIncludes lists only ref fields', () => {
  assert.deepEqual(refIncludes([{ name: 'name', type: 'string' }, owner, status]), ['owner']);
});

test('ref cells show the joined label, falling back to the id', () => {
  assert.equal(formatCell(owner, { owner: 'u-1', owner_label: 'Thandi' }), 'Thandi');
  assert.equal(formatCell(owner, { owner: 'u-1', owner_label: null }), 'u-1');
  assert.equal(formatCell(owner, { owner: null }), '');
});

test('enum, boolean and empty cells', () => {
  assert.equal(formatCell(status, { status: 'active' }), 'Active');
  assert.equal(formatCell(status, { status: 'churned' }), 'churned');
  assert.equal(formatCell({ name: 'ok', type: 'boolean' }, { ok: false }), 'No');
  assert.equal(formatCell(undefined, { x: 1 }), '');
});

test('date keeps the calendar day; datetime includes the time', () => {
  const date: FieldDef = { name: 'd', type: 'date' };
  const datetime: FieldDef = { name: 'd', type: 'datetime' };
  const iso = '2026-12-01T00:00:00.000Z';
  assert.equal(formatCell(date, { d: iso }, 'en-US'), 'Dec 1, 2026');
  assert.equal(formatCell(datetime, { d: iso }, 'en-US'), new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }));
  assert.equal(formatCell(date, { d: 'not a date' }), 'not a date');
});

test('datetime inputs display stored ISO values and serialize local selections as instants', () => {
  const instant = '2026-12-01T09:30:00.000Z';
  const input = localDatetimeValue(instant);
  assert.match(input, /^2026-12-01T\d\d:\d\d$/);
  assert.equal(datetimeFromInput(input), instant);
  assert.equal(datetimeFromInput('2026-12-01'), undefined);
  assert.equal(localDatetimeValue(undefined), '');
});
