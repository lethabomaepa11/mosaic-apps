<script lang="ts">
  import { TextField, TextArea, NumberField, Switch, SelectField, ColorPicker, JsonEditor, getComponent, type PropDesc } from '$ui';
  import { findNode, type FormNode } from '@mosaic/core';
  import { designer } from '#lib/designer.svelte';
  import Control from './Control.svelte';

  function selectedNode(): FormNode | null {
    if (!designer.root || !designer.selectedId) return null;
    return findNode(designer.root, designer.selectedId);
  }

  function setProp(key: string, value: unknown) {
    const n = selectedNode();
    if (!n) return;
    designer.updateProps(n.id, { ...(n.props ?? {}), [key]: value });
  }
</script>

<aside class="designer__panel">
  <div class="designer__panel-title">Properties</div>
  <div class="designer__panel-body" style="padding:14px">
    {#if !designer.root}
      <p class="m-muted m-small">Load a form or page to edit.</p>
    {:else if !designer.selectedId}
      <p class="m-muted m-small">Select a component on the canvas to edit its properties.</p>
    {:else}
      {@const n = selectedNode()}
      {#if n}
        {@const def = getComponent(n.type)}
        {#if def}
          <div class="m-row" style="justify-content:space-between;margin-bottom:12px">
            <strong>{def.label}</strong>
            <span class="m-badge">{n.type}</span>
          </div>
          {#each def.inspector ?? [] as prop (prop.key)}
            <div class="inspector-prop">
              <Control desc={prop} value={(n.props ?? {})[prop.key]} onChange={(v) => setProp(prop.key, v)} />
            </div>
          {/each}
          <div class="m-row" style="margin-top:14px">
            <button class="m-btn m-btn--secondary m-btn--sm" onclick={() => designer.duplicate(n.id)}>Duplicate</button>
            <button class="m-btn m-btn--danger m-btn--sm" onclick={() => designer.remove(n.id)}>Delete</button>
          </div>
        {:else}
          <p class="m-muted m-small">Unknown component type: {n.type}</p>
        {/if}
      {/if}
    {/if}
  </div>
</aside>
