<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';
  import Icon from './Icon.svelte';

  interface MenuItem {
    label: string;
    icon?: string;
    danger?: boolean;
    separator?: boolean;
    onclick?: () => void;
  }

  interface Props {
    label?: string;
    icon?: string;
    items: MenuItem[];
    align?: 'left' | 'right';
    trigger?: Snippet;
  }

  let { label = 'More', icon = 'moreVertical', items, align = 'left', trigger }: Props = $props();
</script>

<div class="m-menu">
<BitsDropdownMenu.Root>
  <BitsDropdownMenu.Trigger class="m-btn m-btn--secondary m-btn--sm" aria-haspopup="menu">
    {#if trigger}
      {@render trigger()}
    {:else}
      <Icon name={icon} size={14} /> {label}
    {/if}
  </BitsDropdownMenu.Trigger>
  <BitsDropdownMenu.Portal>
    <BitsDropdownMenu.Content class="m-menu__list" align={align === 'right' ? 'end' : 'start'} sideOffset={4}>
      {#each items as item, index (`${item.label}-${index}`)}
        {#if item.separator}
          <BitsDropdownMenu.Separator class="m-menu__sep" />
        {:else}
          <BitsDropdownMenu.Item class={item.danger ? 'm-menu__item m-menu__item--danger' : 'm-menu__item'} onSelect={() => item.onclick?.()}>
            {#if item.icon}<Icon name={item.icon} size={14} />{/if}
            {item.label}
          </BitsDropdownMenu.Item>
        {/if}
      {/each}
    </BitsDropdownMenu.Content>
  </BitsDropdownMenu.Portal>
</BitsDropdownMenu.Root>
</div>
