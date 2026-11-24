import assert from 'node:assert/strict';
import test from 'node:test';
import { diffArtifactSnapshots } from './revision-diff.js';

test('diffArtifactSnapshots reports stable nested changes', () => {
  assert.deepEqual(
    diffArtifactSnapshots(
      { name: 'Contact', settings: { submit: 'Save', hidden: true } },
      { name: 'Contact us', settings: { submit: 'Send' } },
    ),
    [
      { path: 'name', kind: 'changed', before: 'Contact', after: 'Contact us' },
      { path: 'settings.hidden', kind: 'removed', before: true },
      { path: 'settings.submit', kind: 'changed', before: 'Save', after: 'Send' },
    ],
  );
});

test('diffArtifactSnapshots treats array edits as one reviewable change', () => {
  assert.deepEqual(diffArtifactSnapshots({ children: ['a'] }, { children: ['a', 'b'] }), [
    { path: 'children', kind: 'changed', before: ['a'], after: ['a', 'b'] },
  ]);
});
