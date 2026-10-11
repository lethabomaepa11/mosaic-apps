<script lang="ts">
  import { getComponent, isContainerType, draggable, dropzone, dragState, targetIndexFor, type DragPayload } from '$ui';
  import type { FormNode } from '@mosaic-apps/mosaic-core';
  import { designer } from '#lib/designer.svelte';
  import { Icon } from '$ui';
  import CanvasNode from './CanvasNode.svelte';

  interface Props {
    node: FormNode;
    depth?: number;
  }

  let { node, depth = 0 }: Props = $props();

  const def = $derived(getComponent(node.type));
  const selected = $derived(designer.selectedId === node.id);
  const isRoot = $derived(depth === 0);
  let context = $state<{ x: number; y: number } | null>(null);

  function onSelect(e: Event) {
    e.stopPropagation();
    designer.select(node.id);
  }

  function onContextMenu(e: MouseEvent) {
    if (isRoot) return;
    e.preventDefault();
    e.stopPropagation();
    context = { x: e.clientX, y: e.clientY };
    designer.select(node.id);
  }

  async function copyJson() {
    await navigator.clipboard?.writeText(JSON.stringify(node, null, 2));
    context = null;
  }

  function onDrop(index: number, payload: DragPayload) {
    if (payload.kind === 'palette' && payload.type) {
      designer.addAt(node.id, index, payload.type);
    } else if (payload.kind === 'node' && payload.sourceId) {
      designer.move(payload.sourceId, node.id, index);
    }
  }
</script>

<!-- Pointer selection covers the preview surface; the visible tag is keyboard accessible. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="design-node"
  class:selected
  role="group"
  aria-label={`${def?.label ?? node.type}${selected ? ', selected' : ''}`}
  onpointerdown={onSelect}
  oncontextmenu={onContextMenu}
  data-mosaic-dnd="ignore"
  use:draggable={{
    payload: { kind: 'node', sourceId: node.id, type: node.type } as DragPayload,
    label: node.type,
    disabled: isRoot,
  }}
>
  <button type="button" class="design-node__tag" aria-pressed={selected} onclick={onSelect}>{def?.label ?? node.type}</button>
  {#if !isRoot}
    <span class="design-node__actions">
      <button onclick={(e) => { e.stopPropagation(); designer.duplicate(node.id); }} title="Duplicate"><Icon name="copy" size={14} /></button>
      <button onclick={(e) => { e.stopPropagation(); designer.remove(node.id); }} title="Delete"><Icon name="trash2" size={14} /></button>
    </span>
  {/if}

  {#if def && isContainerType(node.type)}
    {@const Comp = def.component}
    <div class="design-render">
      <Comp {...(node.props ?? {})}>
        <div class="design-children" use:dropzone={{ id: node.id, onDrop }}>
          {#if (node.children ?? []).length === 0}
            <div class="design-empty">Drop components here</div>
          {:else}
            {#each node.children ?? [] as child, i (child.id)}
              {#if targetIndexFor(node.id) === i}
                <div class="design-drop-hint"></div>
              {/if}
              <CanvasNode node={child} depth={depth + 1} />
            {/each}
            {#if targetIndexFor(node.id) === (node.children ?? []).length}
              <div class="design-drop-hint"></div>
            {/if}
          {/if}
        </div>
      </Comp>
    </div>
  {:else if def}
    {@const Comp = def.component}
    <div class="design-render">
      <Comp {...(node.props ?? {})} value={node.props?.value ?? ''} />
    </div>
  {:else if isRoot}
    <div class="design-children" use:dropzone={{ id: node.id, onDrop }}>
      {#if (node.children ?? []).length === 0}
        <div class="design-empty">Drop components here</div>
      {:else}
        {#each node.children ?? [] as child, i (child.id)}
          {#if targetIndexFor(node.id) === i}
            <div class="design-drop-hint"></div>
          {/if}
          <CanvasNode node={child} depth={depth + 1} />
        {/each}
        {#if targetIndexFor(node.id) === (node.children ?? []).length}
          <div class="design-drop-hint"></div>
        {/if}
      {/if}
    </div>
  {:else}
    <div class="m-alert m-alert--warning">Unknown: {node.type}</div>
  {/if}
</div>

{#if context}
  <div class="node-context" style={`left:${context.x}px;top:${context.y}px`} role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') context = null; }}>
    <button role="menuitem" onclick={() => { designer.duplicate(node.id); context = null; }}><Icon name="copy" size={14} /> Duplicate</button>
    <button role="menuitem" onclick={() => { void navigator.clipboard?.writeText(node.id); context = null; }}><Icon name="clipboard" size={14} /> Copy ID</button>
    <button role="menuitem" onclick={copyJson}><Icon name="braces" size={14} /> Copy JSON</button>
    <button role="menuitem" onclick={() => { designer.remove(node.id); context = null; }}><Icon name="trash2" size={14} /> Delete</button>
  </div>
{/if}
<svelte:window onclick={() => (context = null)} />

{#if dragState.active}
  <div
    class="drag-ghost"
    style="left:{dragState.x - dragState.offsetX}px;top:{dragState.y - dragState.offsetY}px"
  >
    {dragState.ghost?.label ?? ''}
  </div>
{/if}

<style>
  .drag-ghost {
    position: fixed;
    z-index: 2000;
    pointer-events: none;
    background: var(--m-primary);
    color: #fff;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 6px;
    box-shadow: var(--m-shadow-lg);
  }
  .node-context { position:fixed; z-index:3000; display:grid; min-width:150px; padding:4px; background:var(--m-surface); border:1px solid var(--m-border); border-radius:8px; box-shadow:var(--m-shadow-lg); }
  .node-context button { display:flex; align-items:center; gap:8px; padding:7px 9px; border:0; background:none; color:var(--m-fg); text-align:left; border-radius:5px; cursor:pointer; font:inherit; font-size:.78rem; }
  .node-context button:hover { background:var(--m-surface-2); }
</style>

