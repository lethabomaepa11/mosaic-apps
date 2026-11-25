<script lang="ts">
  import { walk, type FormNode } from '@mosaic-apps/core';
  import { designer } from '#lib/studio/designer.svelte';
  import { Icon, Menu } from '@mosaic-apps/ui';

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

<aside class="designer__panel" style="width:100%">
  <div class="designer__panel-title">Layers</div>
  <div class="designer__panel-body" style="padding:10px">
    {#each rows as row (row.node.id)}
      <div class="layer-row">
        <button class="m-menu__item" class:active={designer.selectedId === row.node.id} style="padding-left:{8 + row.depth * 12}px;font-weight:{designer.selectedId === row.node.id ? 700 : 500}" onclick={() => designer.select(row.node.id)}>
          <Icon name={row.node.children?.length ? 'chevronRight' : 'circle'} size={13} /> {row.node.type}
          {#if typeof row.node.props?.binding === 'string' && row.node.props.binding}<span class="m-badge" style="margin-left:auto">{row.node.props.binding}</span>{/if}
        </button>
        <Menu icon="moreVertical" items={[
          { label: 'Duplicate', icon: 'copy', onclick: () => designer.duplicate(row.node.id) },
          { label: 'Copy ID', icon: 'clipboard', onclick: () => navigator.clipboard?.writeText(row.node.id) },
          { label: 'Copy JSON', icon: 'braces', onclick: () => navigator.clipboard?.writeText(JSON.stringify(row.node, null, 2)) },
          { label: 'Delete', icon: 'trash2', danger: true, onclick: () => designer.remove(row.node.id) },
        ]}>{#snippet trigger()}<Icon name="moreVertical" size={14} /><span class="sr-only">Actions for {row.node.type}</span>{/snippet}</Menu>
      </div>
    {/each}
  </div>
</aside>

<style>
  .active { background: var(--m-primary-soft); }
  .layer-row { display:flex; align-items:center; }
  .layer-row > button:first-child { flex:1; min-width:0; }
</style>

