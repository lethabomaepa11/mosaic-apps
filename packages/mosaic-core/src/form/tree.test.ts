import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { FormNode } from '../types/form.js';
import {
  cloneTree,
  collectBindings,
  countByType,
  duplicateNode,
  ensureRoot,
  findNode,
  insertNode,
  moveNode,
  pathTo,
  removeNode,
} from './tree.js';

function makeRoot(): FormNode {
  return { id: 'root', type: 'form', children: [] };
}

test('insert / find / path', () => {
  const root = makeRoot();
  assert.ok(insertNode(root, 'root', { id: 'a', type: 'grid', children: [] }));
  assert.ok(insertNode(root, 'a', { id: 'a1', type: 'textField', props: { binding: 'name' } }));
  assert.ok(findNode(root, 'a1'));
  assert.equal(pathTo(root, 'a1')?.join('/'), 'root/a/a1');
  assert.equal(findNode(root, 'zzz'), null);
});

test('move reorders and reparents; moving into own subtree blocked', () => {
  const root = makeRoot();
  insertNode(root, 'root', { id: 'a', type: 'grid', children: [] });
  insertNode(root, 'root', { id: 'b', type: 'grid', children: [] });
  insertNode(root, 'a', { id: 'a1', type: 'textField' });
  assert.ok(moveNode(root, 'b', 'root', 0));
  assert.deepEqual(root.children?.map((c) => c.id), ['b', 'a']);
  assert.ok(!moveNode(root, 'a', 'a1', 0)); // a1 not a container anyway
  assert.ok(!moveNode(root, 'a', 'a', 0)); // cannot move into self
});

test('remove returns node and detaches', () => {
  const root = makeRoot();
  insertNode(root, 'root', { id: 'a', type: 'text' });
  const removed = removeNode(root, 'a');
  assert.equal(removed?.id, 'a');
  assert.equal(root.children?.length, 0);
  assert.equal(removeNode(root, 'root'), null);
});

test('duplicate clones subtree with fresh ids', () => {
  const root = makeRoot();
  insertNode(root, 'root', { id: 'a', type: 'grid', children: [{ id: 'a1', type: 'textField' }] });
  const copy = duplicateNode(root, 'a');
  assert.ok(copy);
  assert.notEqual(copy!.id, 'a');
  assert.equal(copy!.children?.[0]?.id !== 'a1', true);
  assert.equal(root.children?.length, 2);
});

test('cloneTree keeps structure deep', () => {
  const node: FormNode = { id: 'x', type: 'card', props: { title: 'T' }, children: [{ id: 'y', type: 'text' }] };
  const clone = cloneTree(node);
  assert.notEqual(clone.id, 'x');
  assert.equal(clone.props?.title, 'T');
  assert.equal(clone.children?.[0]?.type, 'text');
});

test('bindings collection and counts', () => {
  const root = ensureRoot({ id: 'root', type: 'form', children: [] });
  insertNode(root, 'root', { id: 'a', type: 'textField', props: { binding: 'email' } });
  insertNode(root, 'root', { id: 'b', type: 'selectField', props: { binding: 'status' } });
  assert.deepEqual(collectBindings(root).sort(), ['email', 'status']);
  assert.deepEqual(countByType(root), { form: 1, textField: 1, selectField: 1 });
});
