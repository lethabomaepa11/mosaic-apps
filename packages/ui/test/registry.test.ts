import assert from 'node:assert/strict';
import test from 'node:test';
import type { Component } from 'svelte';
import { createComponentRegistry } from '../src/registry/store.js';

const component = {} as Component<Record<string, unknown>>;

test('custom component registrations support lookup, replacement, and cleanup', () => {
  const builtIn = { type: 'text', label: 'Text', category: 'Display', icon: 'type', component } as const;
  const registry = createComponentRegistry([builtIn]);
  const definition = {
    type: 'acme.metric-card',
    label: 'Metric card',
    category: 'Data',
    icon: 'barChart',
    component,
    pages: true,
    defaults: { label: 'Revenue' },
    inspector: [{ key: 'label', label: 'Label', kind: 'string' }],
  } as const;
  const dispose = registry.register(definition);
  assert.equal(registry.get('acme.metric-card'), definition);
  assert.equal(registry.isCustom('acme.metric-card'), true);
  assert.equal(registry.components.includes(definition), true);
  dispose();
  assert.equal(registry.get('acme.metric-card'), undefined);

  const override = { ...builtIn, label: 'Better text' };
  registry.register(override, { replace: true });
  assert.equal(registry.get('text'), override);
  registry.unregister('text');
  assert.equal(registry.get('text'), builtIn);
});

test('registration rejects invalid or duplicate component types', () => {
  const registry = createComponentRegistry([]);
  assert.throws(() => registry.register({ type: 'Bad Type', label: 'Bad', category: 'Display', icon: 'x', component }));
  const dispose = registry.register({ type: 'acme.notice', label: 'Notice', category: 'Display', icon: 'bell', component });
  assert.throws(() => registry.register({ type: 'acme.notice', label: 'Again', category: 'Display', icon: 'bell', component }));
  dispose();
});
