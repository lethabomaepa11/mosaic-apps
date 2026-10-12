<script lang="ts">
  /**
   * PageRenderer - renders a published PageDef (component tree) at runtime.
   * Data-aware components (entityTable, statCard, refSelect) receive the client.
   */

  import { ensureRoot, evaluateBoolean, type FormNode, type PageDef } from '@mosaic-apps/core';
  import type { MosaicClient } from '../client/api';
  import NodeRenderer from './NodeRenderer.svelte';
  import { fade } from 'svelte/transition';
  import { getContext, setContext, onDestroy } from 'svelte';
  import { themeState } from '../lib/theme.svelte';
  import { createMosaicState, MOSAIC_STATE_CONTEXT, type MosaicState } from '../state/store';
  import ActionConfirmation from '../components/ActionConfirmation.svelte';
  import { ACTION_CONFIRMATION_CONTEXT, type MosaicConfirm } from '../actions/confirmation';

  interface Props {
    page: PageDef;
    client: MosaicClient;
    /** form data scope for the page (route params, query, etc.) */
    scope?: Record<string, unknown>;
    state?: MosaicState;
    includeMetadata?: boolean;
  }

  let { page, client, scope, state: suppliedState, includeMetadata = true }: Props = $props();

  const setLayout = getContext<((layout: 'app' | 'bare') => () => void) | undefined>('mosaic:page-layout');
  $effect(() => setLayout?.(page.settings?.layout === 'bare' ? 'bare' : 'app'));

  const inheritedState = getContext<MosaicState | undefined>(MOSAIC_STATE_CONTEXT);
  // svelte-ignore state_referenced_locally -- choose the page state scope once at renderer creation.
  const runtimeState = suppliedState ?? inheritedState?.forkPage() ?? createMosaicState();
  setContext(MOSAIC_STATE_CONTEXT, runtimeState);
  let confirmation = $state<{ confirm: MosaicConfirm }>();
  setContext<MosaicConfirm>(ACTION_CONFIRMATION_CONTEXT, options => confirmation?.confirm(options) ?? Promise.resolve(false));
  let stateRevision = $state(0);
  const unsubscribers = [runtimeState.application, runtimeState.page, runtimeState.form]
    .map((store) => store.subscribe(() => { stateRevision += 1; }, false));
  onDestroy(() => unsubscribers.forEach((unsubscribe) => unsubscribe()));

  $effect(() => {
    if (scope) runtimeState.page.update(() => ({ ...scope }));
  });

  const root = $derived(ensureRoot({ ...page.root }));
  const transition = $derived(page.settings?.transition ?? themeState.transition);
  const duration = $derived(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : (transition?.kind ?? 'fade') === 'none' ? 0 : transition?.duration ?? 180);
  const seo = $derived(page.settings?.seo);

  function expressionScope() {
    stateRevision;
    return { data: scope ?? {}, application: runtimeState.application.snapshot(), page: runtimeState.page.snapshot(), form: runtimeState.form.snapshot() };
  }
  function visible(node: FormNode): boolean {
    const expression = node.props?.visibleIf;
    return typeof expression === 'string' && expression ? evaluateBoolean(expression, expressionScope(), true) : true;
  }
  function disabled(node: FormNode): boolean {
    const expression = node.props?.disabledIf;
    return typeof expression === 'string' && expression ? evaluateBoolean(expression, expressionScope(), false) : false;
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

<div class={`m-root m-stack m-transition-${transition?.kind ?? 'fade'}`} style={`--m-enter-duration:${duration}ms;--m-enter-delay:${transition?.delay ?? 0}ms`} in:fade={{ duration, delay: transition?.delay ?? 0 }}>
  {#each root.children ?? [] as child, index (child.id)}
    {@const childTransition = { ...(transition ?? {}), delay: (transition?.delay ?? 0) + index * 18 }}
    <NodeRenderer node={child} {visible} {disabled} {client} data={scope} transition={childTransition} />
  {/each}
</div>

<style>
  .m-transition-slide { animation: m-enter-slide var(--m-enter-duration, 180ms) ease both; animation-delay: var(--m-enter-delay, 0ms); }
  .m-transition-scale { animation: m-enter-scale var(--m-enter-duration, 180ms) ease both; animation-delay: var(--m-enter-delay, 0ms); }
  .m-transition-blur { animation: m-enter-blur var(--m-enter-duration, 180ms) ease both; animation-delay: var(--m-enter-delay, 0ms); }
  @keyframes m-enter-slide { from { opacity:0; transform:translateY(6px); } }
  @keyframes m-enter-scale { from { opacity:0; transform:scale(.98); } }
  @keyframes m-enter-blur { from { opacity:0; filter:blur(4px); } }
  @media (prefers-reduced-motion: reduce) { .m-root { animation:none !important; } }
</style>
