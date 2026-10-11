<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as BitsDialog } from 'bits-ui';
  import Icon from './Icon.svelte';

  interface Props {
    open?: boolean;
    title?: string;
    size?: 'md' | 'lg';
    onclose?: () => void;
    footer?: Snippet;
    children: Snippet;
  }

  let { open = $bindable(false), title, size = 'md', onclose, footer, children }: Props = $props();

  function onOpenChange(next: boolean) {
    open = next;
    if (!next) onclose?.();
  }
</script>

{#if open}
  <BitsDialog.Root {open} {onOpenChange}>
    <BitsDialog.Portal>
      <BitsDialog.Overlay class="m-overlay" />
      <BitsDialog.Content class={size === 'lg' ? 'm-modal m-modal--lg' : 'm-modal'}>
        {#if title}
          <header class="m-modal__header">
            <BitsDialog.Title>{title}</BitsDialog.Title>
            <BitsDialog.Close class="m-btn m-btn--ghost m-btn--icon" aria-label="Close"><Icon name="x" size={16} /></BitsDialog.Close>
          </header>
        {/if}
        <div class="m-modal__body">{@render children()}</div>
        {#if footer}<footer class="m-modal__footer">{@render footer()}</footer>{/if}
      </BitsDialog.Content>
    </BitsDialog.Portal>
  </BitsDialog.Root>
{/if}
