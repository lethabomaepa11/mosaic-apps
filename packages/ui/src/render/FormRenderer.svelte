<script lang="ts">
  /**
   * FormRenderer - renders a FormDef (JSON) into a live, validated form.
   * Handles: bindings, visibleIf/disabledIf expressions, field validation,
   * defaults, submit via MosaicClient (or custom onsubmit), toasts.
   */

  import { ensureRoot, evaluateBoolean, walk, type EntityDef, type FormDef, type FormNode } from '@mosaic-apps/core';
  import { getComponent } from '../registry/index';
  import type { MosaicClient } from '../client/api';
  import { toast } from '../stores/toast.svelte';
  import { fade } from 'svelte/transition';
  import { getContext, setContext, untrack, onDestroy } from 'svelte';
  import { themeState } from '../lib/theme.svelte';
  import { createMosaicState, MOSAIC_STATE_CONTEXT, type MosaicState } from '../state/store';
  import NodeRenderer from './NodeRenderer.svelte';

  interface Props {
    form: FormDef;
    record?: Record<string, unknown>;
    mode?: 'create' | 'edit' | 'view';
    client?: MosaicClient;
    entity?: EntityDef;
    onsaved?: (record: Record<string, unknown>) => void;
    onsubmit?: (data: Record<string, unknown>) => void | Promise<void>;
    onchange?: (data: Record<string, unknown>) => void;
    showActions?: boolean;
    includeMetadata?: boolean;
    state?: MosaicState;
    className?: string;
  }

  let { form, record, mode = 'create', client, entity, onsaved, onsubmit, onchange, showActions = true, includeMetadata = true, state: suppliedState, className = '' }: Props = $props();

  const parentFormStack = getContext<{ ids: string[] }>('mosaic:embedded-form-stack');
  // svelte-ignore state_referenced_locally -- descendants need this path at setup; an effect updates form changes.
  let embeddedFormStack = $state<{ ids: string[] }>({ ids: [...(parentFormStack?.ids ?? []), ...(form.id ? [form.id] : [])] });
  setContext('mosaic:embedded-form-stack', embeddedFormStack);
  $effect(() => {
    const ancestors = parentFormStack?.ids ?? [];
    embeddedFormStack.ids = [...ancestors, ...(ancestors.at(-1) === form.id ? [] : [form.id])];
  });

  const inheritedState = getContext<MosaicState | undefined>(MOSAIC_STATE_CONTEXT);
  // svelte-ignore state_referenced_locally -- choose the runtime state scope once when the renderer is created.
  const runtimeState = suppliedState ?? inheritedState?.forkForm() ?? createMosaicState();
  setContext(MOSAIC_STATE_CONTEXT, runtimeState);

  // svelte-ignore state_referenced_locally -- intentional: snapshot initial record into local editable state
  let data = $state<Record<string, unknown>>({ ...(record ?? runtimeState.form.snapshot()) });
  let errors = $state<Record<string, string>>({});
  let saving = $state(false);
  let stateRevision = $state(0);

  const unsubscribers = [runtimeState.application, runtimeState.page, runtimeState.form, runtimeState.component]
    .map((store) => store.subscribe(() => { stateRevision += 1; }, false));
  unsubscribers.push(runtimeState.form.subscribe((next) => {
    if (JSON.stringify(data) === JSON.stringify(next)) return;
    data = { ...next };
    onchange?.(structuredClone($state.snapshot(data)));
  }, false));
  onDestroy(() => unsubscribers.forEach((unsubscribe) => unsubscribe()));

  $effect(() => {
    const next = record ? structuredClone($state.snapshot(record)) : undefined;
    untrack(() => {
      if (next) data = next;
      runtimeState.form.update(() => structuredClone($state.snapshot(data)));
    });
  });

  const root = $derived(ensureRoot({ ...form.root }));
  const entityName = $derived(form.entity ?? entity?.name);
  const transition = $derived(form.settings?.transition ?? themeState.transition);
  const transitionDuration = $derived(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : (transition?.kind ?? 'fade') === 'none' ? 0 : transition?.duration ?? 180);
  const seo = $derived(form.settings?.seo);

  function expressionScope() {
    stateRevision;
    return {
      ...data,
      data,
      application: runtimeState.application.snapshot(),
      page: runtimeState.page.snapshot(),
      form: runtimeState.form.snapshot(),
      component: runtimeState.component.snapshot(),
      ctx: { mode },
    };
  }

  function visible(node: FormNode): boolean {
    const expr = node.props?.visibleIf;
    if (!expr || typeof expr !== 'string') return true;
    return evaluateBoolean(expr, expressionScope(), true);
  }

  function disabled(node: FormNode): boolean {
    if (mode === 'view') return true;
    const expr = node.props?.disabledIf;
    if (!expr || typeof expr !== 'string') return false;
    return evaluateBoolean(expr, expressionScope(), false);
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
    runtimeState.form.update(() => ({ ...data }));
    onchange?.({ ...data });
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
    if (form.settings?.confirmBeforeSubmit && typeof window !== 'undefined' && !window.confirm(form.settings.confirmMessage || 'Submit this form?')) return;
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
      if (form.settings?.redirectAfterSubmit && typeof window !== 'undefined') {
        const target = form.settings.redirectAfterSubmit.trim();
        if ((target.startsWith('/') && !target.startsWith('//') && !target.includes('\\')) || /^https?:\/\//i.test(target)) window.location.assign(target);
      }
    } catch (err) {
      toast.error(form.settings?.errorMessage || 'Could not save', err instanceof Error ? err.message : String(err));
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  {#if includeMetadata}
    {#if seo?.title}<title>{seo.title}</title>{/if}
    {#if seo?.description}<meta name="description" content={seo.description} />{/if}
    {#if seo?.robots}<meta name="robots" content={seo.robots} />{/if}
    {#if seo?.canonicalUrl}<link rel="canonical" href={seo.canonicalUrl} />{/if}
    {#if seo?.socialTitle}<meta property="og:title" content={seo.socialTitle} />{/if}
    {#if seo?.socialDescription}<meta property="og:description" content={seo.socialDescription} />{/if}
    {#if seo?.socialImage}<meta property="og:image" content={seo.socialImage} />{/if}
  {/if}
</svelte:head>

<form class={['m-form-renderer', `m-form-renderer--${form.settings?.layout ?? 'vertical'}`, className, `m-transition-${transition?.kind ?? 'fade'}`].filter(Boolean).join(' ')} style={`--m-form-columns:${Math.max(1, Math.min(4, form.settings?.columns ?? 1))};--m-enter-duration:${transitionDuration}ms;--m-enter-delay:${transition?.delay ?? 0}ms`} in:fade={{ duration: transitionDuration, delay: transition?.delay ?? 0 }} onsubmit={submit} novalidate>
  {#each root.children ?? [] as child, index (child.id)}
    {#if visible(child)}
      {@const childTransition = { ...transition, delay: (transition?.delay ?? 0) + index * 18 }}
      <NodeRenderer node={child} {visible} {disabled} {client} {data} {errors} {mode} onField={onField} transition={childTransition} />
    {/if}
  {/each}
  {#if showActions && mode !== 'view'}
    <div class="m-row m-form-renderer__actions" style="justify-content:flex-end">
      {#if form.settings?.showReset}
        <button type="reset" class="m-btn m-btn--ghost" onclick={() => { data = { ...(record ?? {}) }; runtimeState.form.update(() => ({ ...data })); errors = {}; }}>
          {form.settings?.resetLabel ?? 'Reset'}
        </button>
      {/if}
      <button type="submit" class="m-btn m-btn--primary" disabled={saving}>
        {saving ? 'Saving…' : (form.settings?.submitLabel ?? 'Submit')}
      </button>
    </div>
  {/if}
</form>

<style>
  .m-form-renderer { display:grid; grid-template-columns:repeat(var(--m-form-columns,1),minmax(0,1fr)); gap:var(--m-space-4,1rem); }
  .m-form-renderer--horizontal, .m-form-renderer--inline { display:flex; align-items:flex-start; flex-wrap:wrap; }
  .m-form-renderer--inline { align-items:flex-end; }
  .m-form-renderer__actions { grid-column:1 / -1; margin-top:var(--m-space-2,.5rem); }
  @media (max-width:640px) { .m-form-renderer { grid-template-columns:1fr; } }
</style>
