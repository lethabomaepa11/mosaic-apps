<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as BitsDialog } from 'bits-ui';
  import Icon from './Icon.svelte';

  interface Props {
    open?: boolean;
    title?: string;
    side?: 'left' | 'right';
    onclose?: () => void;
    footer?: Snippet;
    children: Snippet;
  }

  let { open = $bindable(false), title, side = 'right', onclose, footer, children }: Props = $props();

  function onOpenChange(next: boolean) {
    open = next;
    if (!next) onclose?.();
  }
</script>

{#if open}
  <BitsDialog.Root {open} {onOpenChange}>
    <BitsDialog.Portal>
      <BitsDialog.Overlay class="m-drawer-overlay" />
      <BitsDialog.Content class={side === 'left' ? 'm-drawer m-drawer--left' : 'm-drawer'}>
        <header class="m-drawer__header">
          <BitsDialog.Title>{title}</BitsDialog.Title>
          <BitsDialog.Close class="m-btn m-btn--ghost m-btn--icon" aria-label="Close"><Icon name="x" size={16} /></BitsDialog.Close>
        </header>
        <div class="m-drawer__body">{@render children()}</div>
        {#if footer}<footer class="m-panel__footer">{@render footer()}</footer>{/if}
      </BitsDialog.Content>
    </BitsDialog.Portal>
  </BitsDialog.Root>
{/if}
