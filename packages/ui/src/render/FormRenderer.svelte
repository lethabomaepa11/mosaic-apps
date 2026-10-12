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
  import { createMosaicState, MOSAIC_STATE_CONTEXT, StateStore, type MosaicState } from '../state/store';
  import NodeRenderer from './NodeRenderer.svelte';
  import { loadFormSource, resolveFormSource, readDataPath } from '../state/data-source';
  import { FORM_VALIDATION_CONTEXT, type FormValidationRegistry } from '../state/validation';
  import { MOSAIC_NAVIGATION_CONTEXT, type MosaicNavigate } from '../state/navigation';
  import ActionConfirmation from '../components/ActionConfirmation.svelte';
  import { ACTION_CONFIRMATION_CONTEXT, type MosaicConfirm } from '../actions/confirmation';

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

  let { form, record, mode: suppliedMode, client, entity, onsaved, onsubmit, onchange, showActions = true, includeMetadata = true, state: suppliedState, className = '' }: Props = $props();

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
  const navigate = getContext<MosaicNavigate | undefined>(MOSAIC_NAVIGATION_CONTEXT);
  let confirmation = $state<{ confirm: MosaicConfirm }>();
  setContext<MosaicConfirm>(ACTION_CONFIRMATION_CONTEXT, options => confirmation?.confirm(options) ?? Promise.resolve(false));
  const childValidators = new Map<symbol, { label: string; validate: () => boolean }>();
  setContext<FormValidationRegistry>(FORM_VALIDATION_CONTEXT, { register(label, validate) {
    const id = Symbol();
    childValidators.set(id, { label, validate });
    return () => childValidators.delete(id);
  } });

  // svelte-ignore state_referenced_locally -- intentional: snapshot initial record into local editable state
  let data = $state<Record<string, unknown>>({ ...(record ?? runtimeState.form.snapshot()) });
  let errors = $state<Record<string, string>>({});
  let saving = $state(false);
  let stateRevision = $state(0);
  let loadingSource = $state(false);
  let sourceError = $state('');
  let sourceRetry = $state(0);
  let loadedRecord = $state<Record<string, unknown> | undefined>();
  let initialRecord = $state<Record<string, unknown>>({});
  const mode = $derived(suppliedMode ?? form.settings?.mode ?? (record?.id || loadedRecord?.id || data.id ? 'edit' : 'create'));
  let sourceController: AbortController | undefined;
  let sourceKey = '';
  let sourceRun = 0;
  let sourceClient: MosaicClient | undefined;

  const unsubscribers = [runtimeState.application, runtimeState.page, runtimeState.form, runtimeState.component]
    .map((store) => store.subscribe(() => { stateRevision += 1; }, false));
  unsubscribers.push(runtimeState.form.subscribe((next) => {
    if (JSON.stringify(data) === JSON.stringify(next)) return;
    data = { ...next };
    onchange?.(structuredClone($state.snapshot(data)));
  }, false));
  onDestroy(() => { sourceController?.abort(); unsubscribers.forEach((unsubscribe) => unsubscribe()); });

  const root = $derived(ensureRoot({ ...form.root }));
  const entityName = $derived(form.entity ?? entity?.name);
  const transition = $derived(form.settings?.transition ?? themeState.transition);
  const transitionDuration = $derived(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : (transition?.kind ?? 'fade') === 'none' ? 0 : transition?.duration ?? 180);
  const seo = $derived(form.settings?.seo);

  function applyRecord(next: Record<string, unknown>) {
    const defaults = new StateStore(structuredClone(next));
    walk(root, (node) => {
      const binding = node.props?.binding;
      if (typeof binding === 'string' && defaults.getPath(binding) === undefined) {
        const defaultValue = node.props?.default !== undefined ? node.props.default : (node.type === 'switch' || node.type === 'checkbox' ? false : undefined);
        if (defaultValue !== undefined) defaults.setPath(binding, defaultValue);
      }
    });
    const values = defaults.snapshot();
    initialRecord = structuredClone(values);
    data = values;
    errors = {};
    runtimeState.form.update(() => structuredClone(values));
  }

  $effect(() => {
    stateRevision;
    sourceRetry;
    const explicit = record === undefined ? undefined : structuredClone($state.snapshot(record));
    const page = runtimeState.page.snapshot();
    let source;
    try {
      source = resolveFormSource(form.dataSource, {
        application: runtimeState.application.snapshot(), page, form: runtimeState.form.snapshot(),
        component: runtimeState.component.snapshot(),
        query: page.query ?? (typeof location === 'undefined' ? {} : Object.fromEntries(new URLSearchParams(location.search))),
        params: page.params ?? {},
      });
    } catch (error) { sourceRun += 1; sourceController?.abort(); sourceKey = ''; loadingSource = false; sourceError = error instanceof Error ? error.message : 'Invalid form data source.'; return; }
    const key = JSON.stringify({ form: form.id, source, explicit, retry: sourceRetry });
    if (key === sourceKey && client === sourceClient) return;
    const firstSource = sourceKey === '';
    sourceKey = key;
    sourceClient = client;
    const run = ++sourceRun;
    sourceController?.abort();
    const controller = new AbortController();
    sourceController = controller;
    sourceError = '';
    loadedRecord = undefined;
    if (explicit !== undefined || source.kind === 'none') {
      loadingSource = false;
      untrack(() => applyRecord(explicit ?? (firstSource ? structuredClone($state.snapshot(data)) : {})));
      runtimeState.component.set('dataSource', { status: 'ready', error: null });
      return;
    }
    loadingSource = true;
    runtimeState.component.set('dataSource', { status: 'loading', error: null });
    const requireRecord = (suppliedMode ?? form.settings?.mode) !== undefined && (suppliedMode ?? form.settings?.mode) !== 'create';
    void loadFormSource(source, client, { signal: controller.signal, requireRecord }).then((next) => {
      if (run !== sourceRun || controller.signal.aborted) return;
      loadedRecord = next;
      applyRecord(next);
      runtimeState.component.set('dataSource', { status: 'ready', error: null });
    }).catch((error: unknown) => {
      if (run !== sourceRun || controller.signal.aborted) return;
      sourceError = error instanceof Error ? error.message : 'Could not load form data.';
      runtimeState.component.set('dataSource', { status: 'error', error: sourceError });
    }).finally(() => { if (run === sourceRun) loadingSource = false; });
  });

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
    if (mode === 'view' || loadingSource || !!sourceError) {
      if (getComponent(node.type)?.isField) return true;
      const actions = Array.isArray(node.props?.actions) ? node.props.actions as { type?: string; method?: string }[] : [];
      if (actions.some((action) => !['navigate', 'message'].includes(action.type ?? '') && !(action.type === 'api' && (action.method ?? 'GET') === 'GET'))) return true;
    }
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
      const maxLen = Number(p.maxLength ?? p.maxlength ?? 0);
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

  export function validateForm(): boolean {
    if (loadingSource || sourceError) return false;
    if (mode === 'view') return true;
    const errs: Record<string, string> = {};
    walk(root, (node) => {
      const def = getComponent(node.type);
      if (!def?.isField) return;
      const p = node.props ?? {};
      const b = p.binding;
      if (typeof b !== 'string') return;
      if (!visible(node)) return;
      const msg = validateField(p, readDataPath(data, b));
      if (msg) errs[b] = msg;
    });
    for (const child of childValidators.values()) {
      if (!child.validate()) errs.__embedded = `Review ${child.label} before submitting.`;
    }
    errors = errs;
    return Object.keys(errs).length === 0;
  }

  function onField(binding: string, v: unknown) {
    runtimeState.form.setPath(binding, v);
    if (errors[binding]) {
      const next = { ...errors };
      delete next[binding];
      errors = next;
    }
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (mode === 'view' || saving || loadingSource || sourceError) return;
    if (!validateForm()) {
      toast.error('Please check the form', 'Some fields need attention');
      return;
    }
    if (form.settings?.confirmBeforeSubmit && typeof window !== 'undefined' && !window.confirm(form.settings.confirmMessage || 'Submit this form?')) return;
    saving = true;
    try {
      if (onsubmit) {
        await onsubmit(structuredClone($state.snapshot(data)));
      } else if (client && entityName) {
        const submitted = structuredClone($state.snapshot(data));
        const id = record?.id ?? loadedRecord?.id ?? data.id;
        if (mode === 'edit' && !id) throw new Error('Select a record before saving changes.');
        const saved = mode === 'edit' ? await client.updateRecord(entityName, String(id), submitted) : await client.createRecord(entityName, submitted);
        applyRecord(saved);
      } else {
        throw new Error('Choose an entity or configure a submit handler before submitting this form.');
      }
      toast.success(form.settings?.successMessage ?? 'Saved successfully');
      onsaved?.(structuredClone($state.snapshot(data)));
      if (form.settings?.redirectAfterSubmit && typeof window !== 'undefined') {
        const target = form.settings.redirectAfterSubmit.trim();
        if ((target.startsWith('/') && !target.startsWith('//') && !target.includes('\\')) || /^https?:\/\//i.test(target)) {
          if (navigate) await navigate(target);
          else window.location.assign(target);
        }
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
<ActionConfirmation bind:this={confirmation} />

<svelte:element this={showActions ? 'form' : 'div'} class={['m-form-renderer', `m-form-renderer--${form.settings?.layout ?? 'vertical'}`, className, `m-transition-${transition?.kind ?? 'fade'}`].filter(Boolean).join(' ')} style={`--m-form-columns:${Math.max(1, Math.min(4, form.settings?.columns ?? 1))};--m-enter-duration:${transitionDuration}ms;--m-enter-delay:${transition?.delay ?? 0}ms`} in:fade={{ duration: transitionDuration, delay: transition?.delay ?? 0 }} onsubmit={submit} novalidate>
  {#if loadingSource}<div class="m-form-renderer__status" role="status"><span class="m-spinner"></span> Loading record…</div>{/if}
  {#if sourceError}<div class="m-alert m-alert--warning m-form-renderer__status" role="alert">{sourceError} <button type="button" class="m-btn m-btn--secondary m-btn--sm" onclick={() => sourceRetry += 1}>Retry</button></div>{/if}
  {#if errors.__embedded}<div class="m-alert m-alert--warning m-form-renderer__status" role="alert">{errors.__embedded}</div>{/if}
  {#each root.children ?? [] as child, index (child.id)}
    {#if visible(child)}
      {@const childTransition = { ...transition, delay: (transition?.delay ?? 0) + index * 18 }}
      <NodeRenderer node={child} {visible} {disabled} {client} {data} {errors} {mode} onField={onField} transition={childTransition} />
    {/if}
  {/each}
  {#if showActions && mode !== 'view'}
    <div class="m-row m-form-renderer__actions" style="justify-content:flex-end">
      {#if form.settings?.showReset}
        <button type="button" class="m-btn m-btn--ghost" disabled={loadingSource || saving} onclick={() => applyRecord(initialRecord)}>
          {form.settings?.resetLabel ?? 'Reset'}
        </button>
      {/if}
      <button type="submit" class="m-btn m-btn--primary" disabled={saving || loadingSource || !!sourceError}>
        {saving ? 'Saving…' : (form.settings?.submitLabel ?? 'Submit')}
      </button>
    </div>
  {/if}
</svelte:element>

<style>
  .m-form-renderer { display:grid; grid-template-columns:repeat(var(--m-form-columns,1),minmax(0,1fr)); gap:var(--m-space-4,1rem); }
  .m-form-renderer--horizontal, .m-form-renderer--inline { display:flex; align-items:flex-start; flex-wrap:wrap; }
  .m-form-renderer--inline { align-items:flex-end; }
  .m-form-renderer__actions { grid-column:1 / -1; margin-top:var(--m-space-2,.5rem); }
  .m-form-renderer__status { grid-column:1 / -1; }
  @media (max-width:640px) { .m-form-renderer { grid-template-columns:1fr; } }
</style>
