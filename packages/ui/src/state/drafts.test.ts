import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptedDraftStore, type DraftStorageAdapter } from './drafts.js';

test('drafts encrypt content, bind identity and serialize saves and clearing', async () => {
  const values = new Map<string, unknown>();
  const secret = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const adapter: DraftStorageAdapter = { get: async key => values.get(key), put: async (key, value) => { values.set(key, value); }, remove: async key => { values.delete(key); }, encryptionKey: async () => secret };
  const draft = encryptedDraftStore<{ name: string }>(adapter, 'user/api/form/tab');
  await Promise.all([draft.save({ name: 'first' }, 2), draft.save({ name: 'last' }, 2)]);
  assert.equal((await draft.load())?.definition.name, 'last');
  const stored = values.get('user/api/form/tab') as { ciphertext: ArrayBuffer };
  assert.ok(!new TextDecoder().decode(stored.ciphertext).includes('last'));
  values.set('other-user', values.get('user/api/form/tab'));
  await assert.rejects(encryptedDraftStore(adapter, 'other-user').load());
  await Promise.all([draft.save({ name: 'pending' }, 2), draft.clear()]);
  assert.equal(await draft.load(), null);
});

test('invalid and failed draft storage never produce a usable recovered definition', async () => {
  const secret = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const draft = encryptedDraftStore({ get: async () => ({ version: 99 }), put: async () => { throw new Error('Full disk'); }, remove: async () => {}, encryptionKey: async () => secret }, 'artifact');
  await assert.rejects(draft.load(), /unsupported format/);
  await assert.rejects(draft.save({ name: 'work' }, 1), /Full disk/);
  await draft.clear();
  await assert.rejects(draft.save({}, 0), /base version/);
});
