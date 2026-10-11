<script lang="ts">
  import { getComponent, isContainerType } from '../registry/index';
  import type { ComponentAction, FormNode, ScriptCondition, TransitionConfig } from '@mosaic-apps/core';
  import NodeChildren from './NodeChildren.svelte';
  import { fade } from 'svelte/transition';
  import { getContext, onDestroy, setContext } from 'svelte';
  import { actionScope, createActionRunner, type ActionContext } from '../actions/runner';
  import { runBooleanScript } from '../actions/sandbox';
  import { createMosaicState, MOSAIC_STATE_CONTEXT, type MosaicState } from '../state/store';
  import { toast } from '../stores/toast.svelte';

  const input: {
    node: FormNode;
    visible?: (node: FormNode) => boolean;
    disabled?: (node: FormNode) => boolean;
    client?: unknown;
    data?: Record<string, unknown>;
    errors?: Record<string, string>;
    onField?: (binding: string, value: unknown) => void;
    transition?: TransitionConfig;
    mode?: 'create' | 'edit' | 'view';
  } = $props();

  const node = $derived(input.node);
  const visible = $derived(input.visible);
  const disabled = $derived(input.disabled);
  const client = $derived(input.client as import('../client/api').MosaicClient | undefined);
  const data = $derived(input.data);
  const errors = $derived(input.errors);
  const onField = $derived(input.onField);
  const transition = $derived(input.transition);
  const mode = $derived(input.mode ?? 'create');
  const inheritedState = getContext<MosaicState | undefined>(MOSAIC_STATE_CONTEXT) ?? createMosaicState();
  const componentState = inheritedState.forkComponent();
  setContext(MOSAIC_STATE_CONTEXT, componentState);
  const actionContext: ActionContext = { state: componentState, notify: (variant, title, description) => toast[variant](title, description) };
  const actionRunner = createActionRunner(actionContext);
  let actionRunning = $state(false);
  let scriptVisible = $state(true);
  let scriptDisabled = $state(false);
  let stateRevision = $state(0);
  let conditionRun = 0;
  const unsubscribers = [componentState.application, componentState.page, componentState.form, componentState.component]
    .map((store) => store.subscribe(() => (stateRevision += 1)));
  onDestroy(() => unsubscribers.forEach((unsubscribe) => unsubscribe()));
  $effect(() => {
    actionContext.client = client;
    actionContext.data = data;
  });
  const duration = $derived(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : (transition?.kind ?? 'fade') === 'none' ? 0 : transition?.duration ?? 140);
  const delay = $derived(transition?.delay ?? 0);

  const def = $derived(getComponent(node.type));
  const nodeProps = $derived(node.props ?? {});
  const componentMode = $derived(mode === 'view' ? 'view' : nodeProps.mode === 'edit' ? 'edit' : 'create');
  const binding = $derived(typeof nodeProps.binding === 'string' ? nodeProps.binding : undefined);
  const value = $derived(binding && data ? data[binding] : nodeProps.value);
  const error = $derived(binding && errors ? errors[binding] : undefined);
  const actions = $derived(Array.isArray(nodeProps.actions) ? nodeProps.actions as ComponentAction[] : []);

  function scriptCondition(value: unknown): ScriptCondition | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const candidate = value as Partial<ScriptCondition>;
    return candidate.kind === 'script' && typeof candidate.source === 'string' ? candidate as ScriptCondition : undefined;
  }

  $effect(() => {
    const visibleCondition = scriptCondition(nodeProps.visibleIf);
    const disabledCondition = scriptCondition(nodeProps.disabledIf);
    // Track both external data and store mutations before taking the snapshot.
    JSON.stringify(data);
    stateRevision;
    const run = ++conditionRun;
    const state = actionScope(actionContext);
    void Promise.all([
      visibleCondition ? runBooleanScript({ ...visibleCondition, state }) : Promise.resolve(true),
      disabledCondition ? runBooleanScript({ ...disabledCondition, state }) : Promise.resolve(false),
    ]).then(([nextVisible, nextDisabled]) => {
      if (run !== conditionRun) return;
      scriptVisible = nextVisible;
      scriptDisabled = nextDisabled;
    }).catch((error) => {
      if (run !== conditionRun) return;
      scriptVisible = true;
      scriptDisabled = false;
      toast.error('Condition script failed', error instanceof Error ? error.message : String(error));
    });
  });

  // strip framework-level props before spreading into the component
  const rest = $derived(
    Object.fromEntries(
      Object.entries(nodeProps).filter(([k]) => k !== 'binding' && k !== 'visibleIf' && k !== 'disabledIf' && k !== 'colSpan' && k !== 'actions'),
    ),
  );

  function oninput(v: unknown) {
    if (binding) onField?.(binding, v);
    else if (typeof nodeProps.oninput === 'function') (nodeProps.oninput as (v: unknown) => void)(v);
  }

  async function runActions(event: MouseEvent) {
    if (!actions.length || actionRunning) return;
    event.preventDefault();
    actionRunning = true;
    try {
      await actionRunner.execute(node.id, actions);
    } catch (actionError) {
      toast.error('Action failed', actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      actionRunning = false;
    }
  }
</script>

{#if (!visible || visible(node)) && scriptVisible}
  <div class={`m-node-enter m-transition-${transition?.kind ?? 'fade'}`} style={`--m-enter-duration:${duration}ms;--m-enter-delay:${delay}ms;grid-column:span ${Math.max(1, Math.min(4, Number(nodeProps.colSpan ?? 1)))}`} in:fade={{ duration, delay }}>
  {#if def}
    {@const Comp = def.component}
    <Comp
      {...rest}
      {client}
      mode={componentMode}
      {value}
      {error}
      disabled={actionRunning || scriptDisabled || nodeProps.disabled === true || disabled?.(node) === true}
      oninput={oninput}
      onclick={actions.length ? runActions : undefined}
    >
      {#if isContainerType(node.type)}
        <NodeChildren nodes={node.children ?? []} {visible} {disabled} {client} {data} {errors} {mode} {onField} {transition}></NodeChildren>
      {/if}
    </Comp>
  {:else}
    <div class="m-alert m-alert--warning">Unknown component <code>{node.type}</code></div>
  {/if}
  </div>
{/if}

<style>
  .m-node-enter { min-width:0; }
  .m-transition-slide { animation: m-enter-slide var(--m-enter-duration, 180ms) ease both; animation-delay: var(--m-enter-delay, 0ms); }
  .m-transition-scale { animation: m-enter-scale var(--m-enter-duration, 180ms) ease both; animation-delay: var(--m-enter-delay, 0ms); }
  .m-transition-blur { animation: m-enter-blur var(--m-enter-duration, 180ms) ease both; animation-delay: var(--m-enter-delay, 0ms); }
  @keyframes m-enter-slide { from { opacity:0; transform:translateY(6px); } }
  @keyframes m-enter-scale { from { opacity:0; transform:scale(.98); } }
  @keyframes m-enter-blur { from { opacity:0; filter:blur(4px); } }
  @media (prefers-reduced-motion: reduce) { .m-node-enter { animation:none !important; } }
</style>
