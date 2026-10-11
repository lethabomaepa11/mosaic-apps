/**
 * FormRenderer - renders a FormDef (JSON) into a live, validated form.
 * Handles: bindings, visibleIf/disabledIf expressions, field validation,
 * defaults, submit via MosaicClient (or custom onsubmit), toasts.
 */

<script lang="ts">
  import { ensureRoot, evaluateBoolean, walk, type EntityDef, type FormDef, type FormNode } from '@mosaic/core';
  import { getComponent } from '../registry/index';
  import type { MosaicClient } from '../client/api';
  import { toast } from '../stores/toast.svelte';
  import NodeRenderer from './NodeRenderer.svelte';

  interface Props {
    form: FormDef;
    record?: Record<string, unknown>;
    mode?: 'create' | 'edit' | 'view';
    client?: MosaicClient;
    entity?: EntityDef;
    onsaved?: (record: Record<string, unknown>) => void;
    onsubmit?: (data: Record<string, unknown>) => void | Promise<void>;
    className?: string;
  }

  let { form, record, mode = 'create', client, entity, onsaved, onsubmit, className = '' }: Props = $props();

  let data = $state<Record<string, unknown>>({ ...(record ?? {}) });
  let errors = $state<Record<string, string>>({});
  let saving = $state(false);

  const root = $derived(ensureRoot({ ...form.root }));
  const entityName = $derived(form.entity ?? entity?.name);

  function visible(node: FormNode): boolean {
    const expr = node.props?.visibleIf;
    if (!expr || typeof expr !== 'string') return true;
    return evaluateBoolean(expr, { data, ctx: { mode } }, true);
  }

  function disabled(node: FormNode): boolean {
    if (mode === 'view') return true;
    const expr = node.props?.disabledIf;
    if (!expr || typeof expr !== 'string') return false;
    return evaluateBoolean(expr, { data, ctx: { mode } }, false);
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validateField(p: Record<string, unknown>, value: unknown): string | null {
    const label = String(p.label ?? 'Field');
    if (p.required) {
      const empty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
      if (empty) return `${label} is required`;
    }
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string') {
      const minLen = Number(p.minLength ?? 0);
      if (minLen && value.length < minLen) return `Must be at least ${minLen} characters`;
      const maxLen = Number(p.maxlength ?? 0);
      if (maxLen && maxLen > 0 && value.length > maxLen) return `Must be at most ${maxLen} characters`;
      if (p.format === 'email' && !EMAIL_RE.test(value)) return 'Must be a valid email address';
      if (p.format === 'url' && !/^https?:\/\/\S+$/.test(value)) return 'Must be a valid URL';
      if (p.format === 'phone' && !/^\+?[\d ()\-]{5,32}$/.test(value)) return 'Must be a phone number';
    }
    if (typeof value === 'number') {
      if (p.min !== undefined && value < Number(p.min)) return `Must be at least ${p.min}`;
      if (p.max !== undefined && value > Number(p.max)) return `Must be at most ${p.max}`;
    }
    if (p.pattern && typeof value === 'string') {
      try {
        if (!new RegExp(String(p.pattern)).test(value)) return 'Invalid format';
      } catch { /* bad pattern => ignore */ }
    }
    return null;
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    walk(root, (node) => {
      const def = getComponent(node.type);
      if (!def?.isField) return;
      const p = node.props ?? {};
      const b = p.binding;
      if (typeof b !== 'string') return;
      if (!visible(node)) return;
      const msg = validateField(p, data[b]);
      if (msg) errs[b] = msg;
    });
    errors = errs;
    return Object.keys(errs).length === 0;
  }

  function onField(binding: string, v: unknown) {
    data[binding] = v;
    if (errors[binding]) {
      const next = { ...errors };
      delete next[binding];
      errors = next;
    }
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (mode === 'view' || saving) return;
    if (!validate()) {
      toast.error('Please check the form', 'Some fields need attention');
      return;
    }
    saving = true;
    try {
      if (onsubmit) {
        await onsubmit(data);
      } else if (client && entityName) {
        if (record?.id) await client.updateRecord(entityName, String(record.id), data);
        else await client.createRecord(entityName, data);
      }
      toast.success(form.settings?.successMessage ?? 'Saved successfully');
      onsaved?.(data);
    } catch (err) {
      toast.error('Could not save', err instanceof Error ? err.message : String(err));
    } finally {
      saving = false;
    }
  }
</script>

<form class={['m-stack', className].filter(Boolean).join(' ')} onsubmit={submit} novalidate>
  {#each root.children ?? [] as child (child.id)}
    {#if visible(child)}
      <NodeRenderer node={child} {visible} {disabled} {client} {data} {errors} onField={onField} />
    {/if}
  {/each}
  {#if mode !== 'view'}
    <div class="m-row" style="justify-content:flex-end">
      {#if form.settings?.showReset}
        <button type="reset" class="m-btn m-btn--ghost" onclick={() => { data = { ...(record ?? {}) }; errors = {}; }}>
          {form.settings?.resetLabel ?? 'Reset'}
        </button>
      {/if}
      <button type="submit" class="m-btn m-btn--primary" disabled={saving}>
        {saving ? 'Saving…' : (form.settings?.submitLabel ?? 'Submit')}
      </button>
    </div>
  {/if}
</form>
