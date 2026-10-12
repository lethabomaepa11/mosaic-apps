import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateComponentActions, validateDefinitionTree } from './validation.js';

test('definitions reject invalid and duplicated components and unsafe bindings', () => {
  const valid = { id: 'root', type: 'form', children: [{ id: 'name', type: 'textField', props: { binding: 'customer.name' } }] };
  assert.doesNotThrow(() => validateDefinitionTree(valid));
  assert.throws(() => validateDefinitionTree({ ...valid, children: [valid.children[0], valid.children[0]] }), /duplicated/);
  assert.throws(() => validateDefinitionTree({ id: 'root', type: 'form', children: [null] }), /valid id/);
  assert.throws(() => validateDefinitionTree({ id: 'root', type: 'form', props: { binding: '__proto__.name' } }), /invalid data binding/);
  const deep = { id: '0', type: 'form', children: [] as unknown[] }; let parent = deep;
  for (let i = 1; i < 35; i++) { const child = { id: String(i), type: 'panel', children: [] as unknown[] }; parent.children.push(child); parent = child; }
  assert.throws(() => validateDefinitionTree(deep), /layout levels/);
});

test('metadata actions reject malformed routes, state scopes and scripts', () => {
  assert.doesNotThrow(() => validateComponentActions([{ type: 'state.set', target: { scope: 'form', path: 'account.balance' }, value: 10 }]));
  for (const action of [{ type: 'unknown' }, { type: 'api', path: 'https://external.test' }, { type: 'script', source: 12 }, { type: 'navigate', target: 'page', to: 'page', params: [] }, { type: 'state.set', target: { scope: 'form', path: 'constructor.name' } }]) assert.throws(() => validateComponentActions([action]));
});
