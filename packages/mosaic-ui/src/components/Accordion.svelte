<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  interface Item {
    id: string;
    title: string;
    body?: Snippet;
    children?: Snippet;
  }

  interface Props {
    items: Item[];
    multiple?: boolean;
  }

  let { items, multiple = false }: Props = $props();

  // svelte-ignore state_referenced_locally -- intentional: initial open state from props
  let open = $state<Set<string>>(new Set(multiple ? [] : [items[0]?.id ?? '']));

  function toggle(id: string) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else {
      if (!multiple) next.clear();
      next.add(id);
    }
    open = next;
  }
</script>

<div class="m-accordion">
  {#each items as item (item.id)}
    <div class="m-accordion__item">
      <button class="m-accordion__trigger" aria-expanded={open.has(item.id)} onclick={() => toggle(item.id)}>
        {item.title}<Icon name={open.has(item.id) ? 'chevronUp' : 'chevronDown'} size={12} class="accordion-chevron" />
      </button>
      {#if open.has(item.id)}
        <div class="m-accordion__content">
          {#if item.children}{@render item.children()}
          {:else if item.body}{@render item.body()}
          {/if}
        </div>
      {/if}
    </div>
  {/each}
</div>
