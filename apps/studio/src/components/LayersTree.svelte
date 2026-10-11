<script lang="ts">
  import { walk, type FormNode } from '@mosaic/core';
  import { designer } from '#lib/designer.svelte';

  interface Row {
    node: FormNode;
    depth: number;
  }

  const rows = $derived.by(() => {
    if (!designer.root) return [] as Row[];
    const out: Row[] = [];
    walk(designer.root, (n, _parent, depth) => {
      if (depth > 0) out.push({ node: n, depth });
    });
    return out;
  });
</script>

<aside class="designer__panel" style="border-left:1px solid var(--m-border);width:100%">
  <div class="designer__panel-title">Layers</div>
  <div class="designer__panel-body" style="padding:10px">
    {#each rows as row (row.node.id)}
      <button
        class="m-menu__item"
        class:active={designer.selectedId === row.node.id}
        style="padding-left:{8 + row.depth * 12}px;font-weight:{designer.selectedId === row.node.id ? 700 : 500}"
        onclick={() => designer.select(row.node.id)}
      >
        <span style="opacity:.55;width:16px">{row.node.children ? 'â–¸' : 'â€˘'}</span>
        {row.node.type}
        {#if typeof row.node.props?.binding === 'string' && row.node.props.binding}
          <span class="m-badge" style="margin-left:auto">{row.node.props.binding}</span>
        {/if}
      </button>
    {/each}
  </div>
</aside>

<style>
  .active { background: var(--m-primary-soft); }
</style>
