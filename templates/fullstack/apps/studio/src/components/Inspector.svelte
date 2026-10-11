<script lang="ts">
  import { getComponent, Tabs, toast, type PropDesc } from '$ui';
  import { findNode, type FormNode } from '@mosaic-apps/core';
  import { designer } from '#lib/designer.svelte';
  import Control from './Control.svelte';
  let activeTab = $state('properties');

  $effect(() => {
    designer.selectedId;
    activeTab = 'properties';
  });

  function selectedNode(): FormNode | null {
    if (!designer.root || !designer.selectedId) return null;
    return findNode(designer.root, designer.selectedId);
  }

  function setProp(key: string, value: unknown) {
    const n = selectedNode();
    if (!n) return;
    designer.updateProps(n.id, { ...(n.props ?? {}), [key]: value });
  }

  function optionsFor(node: FormNode, prop: PropDesc): string[] {
    return prop.kind === 'columns' ? (designer.entityOptionsByName[String(node.props?.entity ?? '')] ?? []) : designer.bindingOptions;
  }

  async function copyId(id: string) {
    await navigator.clipboard.writeText(id);
    toast.success('Component ID copied');
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
          {@const propertyProps = (def.inspector ?? []).filter((item) => !['visibleIf', 'disabledIf', 'actions'].includes(item.key))}
          {@const logicProps = [def.inspector?.find((item) => item.key === 'visibleIf') ?? { key: 'visibleIf', label: 'Visible when', kind: 'condition' as const, help: 'Safe expression or isolated JavaScript/TypeScript.' }, def.inspector?.find((item) => item.key === 'disabledIf') ?? { key: 'disabledIf', label: 'Disabled when', kind: 'condition' as const }]}
          {@const actionProp = def.inspector?.find((item) => item.key === 'actions') ?? { key: 'actions', label: 'Actions', kind: 'actions' as const }}
          <div class="m-row" style="justify-content:space-between;margin-bottom:12px">
            <div><strong>{def.label}</strong><div class="m-small m-muted">{n.type}</div></div>
            <button type="button" class="m-btn m-btn--ghost m-btn--sm" onclick={() => copyId(n.id)} title="Copy component ID">Copy ID</button>
          </div>
          <Tabs tabs={[{id:'properties',label:'Properties'},{id:'logic',label:'Logic'},{id:'actions',label:'Actions'}]} bind:active={activeTab}>
            {#snippet children(tab)}
              <div class="inspector-tab">
                {#if tab.id === 'properties'}
                  {#if propertyProps.length}
                    {#each propertyProps as prop (prop.key)}<div class="inspector-prop"><Control desc={prop} value={(n.props ?? {})[prop.key]} language={String(n.props?.language ?? 'typescript')} options={optionsFor(n, prop)} artifacts={prop.kind === 'formRef' ? designer.formOptions : []} onChange={(v) => setProp(prop.key, v)} /></div>{/each}
                  {:else}<p class="m-muted m-small">This component has no component-specific properties.</p>{/if}
                {:else if tab.id === 'logic'}
                  {#each logicProps as prop (prop.key)}<div class="inspector-prop"><Control desc={prop} value={(n.props ?? {})[prop.key]} options={optionsFor(n, prop)} onChange={(v) => setProp(prop.key, v)} /></div>{/each}
                {:else}
                  <div class="inspector-prop"><Control desc={actionProp} value={(n.props ?? {}).actions} artifacts={designer.artifactOptions} onChange={(v) => setProp('actions', v)} /></div>
                {/if}
              </div>
            {/snippet}
          </Tabs>
          <div class="m-row" style="margin-top:14px">
            <button class="m-btn m-btn--secondary m-btn--sm" onclick={() => designer.duplicate(n.id)}>Duplicate</button>
            <button class="m-btn m-btn--danger m-btn--sm" onclick={() => designer.remove(n.id)}>Delete</button>
          </div>
        {:else if n.type === 'form' || n.type === 'page'}
          <div class="m-row" style="justify-content:space-between;margin-bottom:12px">
            <strong>{n.type === 'form' ? 'Form root' : 'Page root'}</strong>
            <span class="m-badge">{n.type}</span>
          </div>
          <p class="m-muted m-small">{n.type === 'form' ? 'Form metadata and behavior are configured in Form settings.' : 'Page metadata and behavior are configured in Page settings.'}</p>
        {:else}
          <p class="m-muted m-small">Unknown component type: {n.type}</p>
        {/if}
      {/if}
    {/if}
  </div>
</aside>

<style>
  .inspector-tab { display:grid; gap:12px; padding-top:12px; }
</style>

