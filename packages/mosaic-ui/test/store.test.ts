import test from 'node:test';
import assert from 'node:assert/strict';
import { createMosaicState, StateStore } from '../src/state/store.js';

test('state stores notify with immutable snapshots and revisions', () => {
  const store = new StateStore({ count: 1 });
  const events: number[] = [];
  const unsubscribe = store.subscribe((_state, revision) => events.push(revision));
  store.set('count', 2);
  const snapshot = store.snapshot() as { count: number };
  snapshot.count = 99;
  assert.equal(store.get('count'), 2);
  assert.deepEqual(events, [0, 1]);
  unsubscribe();
  store.set('count', 3);
  assert.deepEqual(events, [0, 1]);
});

test('form and page scopes isolate while child forms share application and page scopes', () => {
  const state = createMosaicState({ application: { user: 'Ada' }, page: { tab: 'main' }, form: { name: 'parent' } });
  const child = state.forkForm({ name: 'child' });
  child.application.set('user', 'Grace');
  child.page.set('tab', 'details');
  child.form.set('name', 'nested');
  assert.equal(state.application.get('user'), 'Grace');
  assert.equal(state.page.get('tab'), 'details');
  assert.equal(state.form.get('name'), 'parent');
  assert.equal(child.form.get('name'), 'nested');
});

test('state snapshots serialize and restore all scopes', () => {
  const state = createMosaicState({ application: { ready: false }, page: { selected: 2 }, form: { title: 'Draft' } });
  const snapshot = state.serialize();
  state.application.set('ready', true);
  state.page.set('selected', 4);
  state.form.set('title', 'Changed');
  state.restore(snapshot);
  assert.deepEqual(state.serialize(), snapshot);
});

test('component scopes isolate and nested state paths are immutable', () => {
  const state = createMosaicState({ form: { customer: { name: 'Ada' } } });
  const first = state.forkComponent({ open: false });
  const second = state.forkComponent({ open: true });
  first.form.setPath('customer.name', 'Grace');
  first.component.setPath('dialog.open', true);
  assert.equal(state.form.getPath('customer.name'), 'Grace');
  assert.equal(first.component.getPath('dialog.open'), true);
  assert.equal(second.component.get('open'), true);
  assert.equal(second.component.getPath('dialog.open'), undefined);
  assert.throws(() => state.form.setPath('__proto__.polluted', true), /Invalid state path/);
});
