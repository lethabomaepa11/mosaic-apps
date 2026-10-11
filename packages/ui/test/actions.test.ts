import test from 'node:test';
import assert from 'node:assert/strict';
import type { MosaicClient } from '../src/client/api.js';
import { createActionRunner } from '../src/actions/runner.js';
import { createMosaicState } from '../src/state/store.js';

test('actions resolve state templates and store API results', async () => {
  const state = createMosaicState({ form: { customerId: 'cus_1' } }).forkComponent();
  const calls: unknown[][] = [];
  const client = {
    async call(method: string, path: string, body: unknown) {
      calls.push([method, path, body]);
      return { ok: true, customerId: 'cus_1' };
    },
  } as unknown as MosaicClient;
  const runner = createActionRunner({ state, client });
  await runner.execute('save', [
    { type: 'state.set', target: { scope: 'page', path: 'selectedId' }, value: '{{form.customerId}}' },
    { type: 'api', method: 'POST', path: '/entities/customer/{{form.customerId}}', body: { id: '{{page.selectedId}}' }, result: { scope: 'application', path: 'lastResult' } },
  ]);
  assert.equal(state.page.getPath('selectedId'), 'cus_1');
  assert.deepEqual(calls, [['POST', '/entities/customer/cus_1', { id: 'cus_1' }]]);
  assert.deepEqual(state.application.getPath('lastResult'), { ok: true, customerId: 'cus_1' });
  assert.equal((state.component.getPath('actions.save') as { status: string }).status, 'succeeded');
});

test('starting an action again cancels its previous request', async () => {
  const state = createMosaicState().forkComponent();
  let aborted = 0;
  const client = {
    call(_method: string, _path: string, _body: unknown, signal?: AbortSignal) {
      return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => { aborted += 1; reject(new DOMException('cancelled', 'AbortError')); }));
    },
  } as unknown as MosaicClient;
  const runner = createActionRunner({ state, client });
  const first = runner.execute('load', [{ type: 'api', path: '/slow' }]);
  const second = runner.execute('load', []);
  await Promise.all([first, second]);
  assert.equal(aborted, 1);
  assert.equal((state.component.getPath('actions.load') as { status: string }).status, 'succeeded');
});
