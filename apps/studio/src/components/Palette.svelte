<script lang="ts">
  import { paletteCategories } from '$ui';
  import { draggable } from '$ui';
  import type { DragPayload } from '$ui';

  const groups = paletteCategories(false);
</script>

<aside class="designer__panel">
  <div class="designer__panel-title">Components</div>
  <div class="designer__panel-body">
    {#each groups as group (group.category)}
      <div class="palette-group">
        <div class="palette-group__name">{group.label}</div>
        {#each group.items as item (item.type)}
          <div
            class="palette-item"
            use:draggable={{
              payload: { kind: 'palette', type: item.type } as DragPayload,
              label: item.label,
            }}
          >
            <span class="icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>
</aside>
