import assert from 'node:assert/strict';
import test from 'node:test';
import { dateInputValue, datetimePayload, displayDate } from '../lib/dates.js';

test('appointment datetimes round-trip in the browser time zone', () => {
  process.env.TZ = 'Africa/Johannesburg';
  const original = '2026-12-01T07:30:19.000Z';
  assert.equal(dateInputValue(original, 'datetime-local'), '2026-12-01T09:30');
  assert.equal(datetimePayload('2026-12-01T09:30', original), original);
  assert.equal(datetimePayload('2026-12-01T10:15'), '2026-12-01T08:15:00.000Z');
  assert.equal(datetimePayload('2026-12-01'), undefined);
  assert.equal(displayDate(original, 'datetime'), 'Dec 1, 2026, 07:30 UTC+00:00');
});

test('calendar dates preserve their day and invalid values stay readable', () => {
  process.env.TZ = 'America/Los_Angeles';
  assert.equal(dateInputValue('2026-12-01T00:00:00.000Z', 'date'), '2026-12-01');
  assert.equal(displayDate('2026-12-01', 'date'), 'Dec 1, 2026');
  assert.equal(displayDate('unknown', 'datetime'), 'unknown');
});
