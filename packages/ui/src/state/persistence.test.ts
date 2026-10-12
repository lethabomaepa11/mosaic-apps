import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateStore } from './store.js';
import { persistState, type StateStorageAdapter } from './persistence.js';

function memory() {
  const values = new Map<string, string>();
  let listener: ((raw: string | null) => void) | undefined;
  const adapter: StateStorageAdapter = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); }, subscribe: (_key, next) => { listener = next; return () => { listener = undefined; }; } };
  return { adapter, values, external: (raw: string | null) => listener?.(raw) };
}

test('persistence is selected-key, versioned, restorable and disposable', () => {
  const storage = memory();
  const state = new StateStore({ theme: 'light', token: 'private-token' });
  const binding = persistState(state, storage.adapter, { key: 'preferences', keys: ['theme'] });
  state.set('theme', 'dark');
  const saved = storage.values.get('preferences')!;
  assert.ok(!saved.includes('private-token'));
  const next = new StateStore({ theme: 'light', token: 'new-session' });
  const restored = persistState(next, storage.adapter, { key: 'preferences', keys: ['theme'] });
  assert.deepEqual(next.snapshot(), { theme: 'dark', token: 'new-session' });
  binding.dispose(); state.set('theme', 'light');
  assert.equal(storage.values.get('preferences'), saved);
  restored.clear(); assert.equal(next.get('theme'), 'light'); assert.equal(storage.values.size, 0);
  restored.dispose();
});

test('expired, incompatible and corrupt envelopes never replace active state', () => {
  const storage = memory(); const errors: Error[] = [];
  for (const value of [JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, updatedAt: 1, writer: 'old', expiresAt: 1, data: { theme: 'dark' } }), '{invalid']) {
    storage.values.set('preferences', value);
    const state = new StateStore({ theme: 'light' });
    persistState(state, storage.adapter, { key: 'preferences', keys: ['theme'], onError: error => errors.push(error) }).dispose();
    assert.equal(state.get('theme'), 'light');
  }
  assert.equal(errors.length, 1);
});

test('cross-tab updates ignore stale writes and clear selected keys without echoing', () => {
  const storage = memory(); const state = new StateStore({ theme: 'light', user: 'active' });
  const binding = persistState(state, storage.adapter, { key: 'preferences', keys: ['theme'], syncTabs: true });
  const write = (updatedAt: number, theme: string) => JSON.stringify({ version: 1, writer: 'remote', updatedAt, data: { theme, user: 'forged' } });
  storage.external(write(Date.now() + 10, 'dark'));
  assert.deepEqual(state.snapshot(), { theme: 'dark', user: 'active' });
  assert.equal(storage.values.size, 0);
  storage.external(write(1, 'old')); assert.equal(state.get('theme'), 'dark');
  storage.external(null); assert.equal(state.get('theme'), 'light');
  binding.dispose(); storage.external(write(Date.now() + 100, 'ignored')); assert.equal(state.get('theme'), 'light');
});

test('storage failures are reported and do not break in-memory updates', () => {
  const errors: Error[] = []; const state = new StateStore({ theme: 'light' });
  const fail = () => { throw new Error('Storage unavailable'); };
  const binding = persistState(state, { getItem: fail, setItem: fail, removeItem: fail }, { key: 'preferences', keys: ['theme'], onError: error => errors.push(error) });
  state.set('theme', 'dark'); binding.clear(); binding.dispose();
  assert.equal(state.get('theme'), 'dark'); assert.equal(errors.length, 3);
  assert.throws(() => persistState(state, memory().adapter, { key: 'preferences', keys: ['__proto__'] }), /safe selected/);
});
