<script lang="ts">
  import type { Snippet } from 'svelte';

  interface MenuItem {
    label: string;
    icon?: string;
    danger?: boolean;
    separator?: boolean;
    onclick?: () => void;
  }

  interface Props {
    label?: string;
    items: MenuItem[];
    align?: 'left' | 'right';
    trigger?: Snippet;
  }

  let { label = '⋮', items, align = 'left', trigger }: Props = $props();
  let open = $state(false);

  function close() {
    open = false;
  }
</script>

<div class="m-menu">
  {#if trigger}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <span onclick={(e) => { e.stopPropagation(); open = !open; }}>{@render trigger()}</span>
  {:else}
    <button class="m-btn m-btn--secondary m-btn--sm" aria-haspopup="menu" aria-expanded={open}
      onclick={(e) => { e.stopPropagation(); open = !open; }}>{label}</button>
  {/if}
  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="m-menu__list" class:m-menu__list--right={align === 'right'} role="menu" onclick={close}>
      {#each items as item (item.label)}
        {#if item.separator}
          <div class="m-menu__sep"></div>
        {:else}
          <button class="m-menu__item" class:m-menu__item--danger={item.danger} role="menuitem"
            onclick={() => { item.onclick?.(); close(); }}>
            {#if item.icon}<span style="opacity:.6">{item.icon}</span>{/if}
            {item.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<svelte:window onclick={close} />
