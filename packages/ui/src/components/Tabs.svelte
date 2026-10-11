<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Tab {
    id: string;
    label: string;
  }

  interface Props {
    tabs: Tab[];
    active?: string;
    onchange?: (id: string) => void;
    children?: Snippet<[{ id: string; label: string }]>;
  }

  let { tabs, active = $bindable(tabs[0]?.id ?? ''), onchange, children }: Props = $props();

  function select(id: string) {
    active = id;
    onchange?.(id);
  }
</script>

<div class="m-tabs">
  <div class="m-tabs__list" role="tablist">
    {#each tabs as tab (tab.id)}
      <button class="m-tabs__tab" class:active={tab.id === active} role="tab" aria-selected={tab.id === active}
        onclick={() => select(tab.id)}>{tab.label}</button>
    {/each}
  </div>
  {#if children}
    <div class="m-tabs__panel">
      {#each tabs.filter((t) => t.id === active) as tab (tab.id)}
        {@render children({ id: tab.id, label: tab.label })}
      {/each}
    </div>
  {/if}
</div>
