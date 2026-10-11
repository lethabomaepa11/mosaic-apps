<script lang="ts">
  import { getComponent, isContainerType, draggable, dropzone, dragState, targetIndexFor, type DragPayload } from '$ui';
  import type { FormNode } from '@mosaic/core';
  import { designer } from '#lib/designer.svelte';

  interface Props {
    node: FormNode;
    depth?: number;
  }

  let { node, depth = 0 }: Props = $props();

  const def = $derived(getComponent(node.type));
  const selected = $derived(designer.selectedId === node.id);
  const isRoot = $derived(depth === 0);

  function onSelect(e: MouseEvent) {
    e.stopPropagation();
    designer.select(node.id);
  }

  function onDrop(index: number, payload: DragPayload) {
    if (payload.kind === 'palette' && payload.type) {
      designer.addAt(node.id, index, payload.type);
    } else if (payload.kind === 'node' && payload.sourceId) {
      designer.move(payload.sourceId, node.id, index);
    }
  }
</script>

<div
  class="design-node"
  class:selected
  onclick={onSelect}
  data-mosaic-dnd="ignore"
  use:draggable={{
    payload: { kind: 'node', sourceId: node.id, type: node.type } as DragPayload,
    label: node.type,
    disabled: isRoot,
  }}
>
  <span class="design-node__tag">{def?.label ?? node.type}</span>
  {#if !isRoot}
    <span class="design-node__actions">
      <button onclick={(e) => { e.stopPropagation(); designer.duplicate(node.id); }}>â§‰</button>
      <button onclick={(e) => { e.stopPropagation(); designer.remove(node.id); }}>âś•</button>
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
              <svelte:self node={child} depth={depth + 1} />
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
      <Comp {...(node.props ?? {})} value={''} />
    </div>
  {:else}
    <div class="m-alert m-alert--warning">Unknown: {node.type}</div>
  {/if}
</div>

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
</style>
