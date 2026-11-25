<script lang="ts">
  import { DataTable, dragState, draggable, Icon, paletteCategories, type ComponentDef } from '$ui';

  const groups = paletteCategories(false);
  const columns = [{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }];
  const rows = [{ name: 'First record', status: 'Active' }, { name: 'Second record', status: 'Draft' }];
  let preview = $state<{ item: ComponentDef; x: number; y: number } | null>(null);

  function show(item: ComponentDef, event: PointerEvent | FocusEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const width = Math.min(292, innerWidth - 24);
    preview = {
      item,
      x: Math.max(12, rect.right + width + 12 <= innerWidth ? rect.right + 8 : rect.left - width - 8),
      y: Math.max(12, Math.min(rect.top, innerHeight - 220)),
    };
  }
</script>

<aside class="designer__panel">
  <div class="designer__panel-title">Components</div>
  <div class="designer__panel-body">
    {#each groups as group (group.category)}
      <div class="palette-group">
        <div class="palette-group__name">{group.label}</div>
        {#each group.items as item (item.type)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div
            class="palette-item"
            role="group"
            tabindex="0"
            onpointerenter={(event) => show(item, event)}
            onpointerleave={() => preview = null}
            onfocusin={(event) => show(item, event)}
            onfocusout={() => preview = null}
            use:draggable={{
              payload: { kind: 'palette', type: item.type },
              label: item.label,
            }}
          >
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>
</aside>

{#if preview && !dragState.active}
  {@const item = preview.item}
  {@const Component = item.component}
  <div class="component-preview" style:left={`${preview.x}px`} style:top={`${preview.y}px`} inert>
    <strong>{item.label}</strong>
    {#key item.type}
      <svelte:boundary>
        {#if item.type === 'dataTable' || item.type === 'entityTable'}
          <DataTable {columns} {rows} />
        {:else}
          <Component {...item.defaults}>
            {#snippet children()}{#if item.container}<span class="m-muted m-small">Child component</span>{/if}{/snippet}
          </Component>
        {/if}
        {#snippet failed()}<span class="m-muted m-small">Preview unavailable until configured.</span>{/snippet}
      </svelte:boundary>
    {/key}
  </div>
{/if}

<style>
  .component-preview {
    position:fixed;
    z-index:100;
    width:min(292px, calc(100vw - 24px));
    max-height:min(208px, calc(100vh - 24px));
    overflow:hidden;
    display:grid;
    gap:8px;
    padding:12px;
    border:1px solid var(--m-border);
    border-radius:var(--m-radius);
    background:var(--m-surface);
    box-shadow:var(--m-shadow-lg);
    pointer-events:none;
  }
</style>
