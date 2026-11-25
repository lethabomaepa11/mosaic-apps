<script lang="ts">
  import { findNode, walk, type FormNode } from '@mosaic-apps/core';
  import { designer } from '#lib/designer.svelte';
  import { draggable, dragState, dropzone, Icon, isContainerType, Menu, targetIndexFor, type DragPayload } from '$ui';

  interface Row {
    node: FormNode;
    depth: number;
    parent: FormNode;
    index: number;
  }

  const rows = $derived.by(() => {
    if (!designer.root) return [] as Row[];
    const out: Row[] = [];
    walk(designer.root, (node, parent, depth) => {
      if (parent) out.push({ node, parent, depth, index: parent.children?.findIndex((child) => child.id === node.id) ?? 0 });
    });
    return out;
  });

  function place(parent: FormNode, index: number, payload: DragPayload) {
    if (payload.kind === 'node' && payload.sourceId) designer.move(payload.sourceId, parent.id, index);
    if (payload.kind === 'palette' && payload.type) designer.addAt(parent.id, index, payload.type);
  }

  function canDrop(row: Row, payload: DragPayload) {
    if (!payload.sourceId) return true;
    if (payload.sourceId === row.node.id || !designer.root) return false;
    const moving = findNode(designer.root, payload.sourceId);
    return !moving || !findNode(moving, row.node.id);
  }
</script>

<aside class="designer__panel" style="width:100%">
  <div class="designer__panel-title">Layers</div>
  <div class="designer__panel-body" style="padding:10px">
    {#each rows as row (row.node.id)}
      {@const zoneId = `layers:${row.node.id}`}
      {@const target = targetIndexFor(zoneId)}
      {@const container = isContainerType(row.node.type)}
      <div class="layer-zone" class:before={target === 0} class:after={target === 1} class:inside={target === 1 && container}
        use:dropzone={{ id: zoneId, hitPadding: 0, canAccept: (payload) => canDrop(row, payload),
          onDrop: (index, payload) => index === 1 && container
            ? place(row.node, row.node.children?.length ?? 0, payload)
            : place(row.parent, row.index + index, payload) }}>
      <div class="layer-row">
        <span class="layer-grip" aria-hidden="true" title="Drag layer"
          use:draggable={{ payload: { kind: 'node', sourceId: row.node.id, type: row.node.type }, label: row.node.type }}><Icon name="grip" size={14} /></span>
        <button class="m-menu__item" class:active={designer.selectedId === row.node.id} style="padding-left:{8 + row.depth * 12}px;font-weight:{designer.selectedId === row.node.id ? 700 : 500}" onclick={() => designer.select(row.node.id)}>
          <Icon name={row.node.children?.length ? 'chevronRight' : 'circle'} size={13} /> {row.node.type}
          {#if typeof row.node.props?.binding === 'string' && row.node.props.binding}<span class="m-badge" style="margin-left:auto">{row.node.props.binding}</span>{/if}
        </button>
        <Menu icon="moreVertical" items={[
          ...(row.index > 0 ? [{ label: 'Move up', onclick: () => designer.move(row.node.id, row.parent.id, row.index - 1) }] : []),
          ...(row.index < (row.parent.children?.length ?? 0) - 1 ? [{ label: 'Move down', onclick: () => designer.move(row.node.id, row.parent.id, row.index + 2) }] : []),
          { label: 'Duplicate', icon: 'copy', onclick: () => designer.duplicate(row.node.id) },
          { label: 'Copy ID', icon: 'clipboard', onclick: () => navigator.clipboard?.writeText(row.node.id) },
          { label: 'Copy JSON', icon: 'braces', onclick: () => navigator.clipboard?.writeText(JSON.stringify(row.node, null, 2)) },
          { label: 'Delete', icon: 'trash2', danger: true, onclick: () => designer.remove(row.node.id) },
        ]}>{#snippet trigger()}<Icon name="moreVertical" size={14} /><span class="sr-only">Actions for {row.node.type}</span>{/snippet}</Menu>
      </div>
      </div>
    {/each}
    {#if designer.root && dragState.active}
      {@const root = designer.root}
      <div class="layer-root" class:active={targetIndexFor('layers:root') !== null}
        use:dropzone={{ id: 'layers:root', hitPadding: 0, onDrop: (_index, payload) => place(root, root.children?.length ?? 0, payload) }}>
        Drop at end of Layers
      </div>
    {/if}
  </div>
</aside>

<style>
  .active { background: var(--m-primary-soft); }
  .layer-row { display:flex; align-items:center; }
  .layer-row > button { flex:1; min-width:0; }
  .layer-grip { cursor:grab; padding:4px; color:var(--m-fg-muted); touch-action:none; }
  .before { box-shadow:inset 0 2px var(--m-primary); }
  .after { box-shadow:inset 0 -2px var(--m-primary); }
  .inside { box-shadow:inset 0 0 0 2px var(--m-primary); border-radius:4px; }
  .layer-root { padding:8px; border:1px dashed var(--m-border-strong); color:var(--m-fg-muted); text-align:center; }
</style>

