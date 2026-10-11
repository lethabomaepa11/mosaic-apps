<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open?: boolean;
    title?: string;
    size?: 'md' | 'lg';
    onclose?: () => void;
    footer?: Snippet;
    children: Snippet;
  }

  let { open = $bindable(false), title, size = 'md', onclose, footer, children }: Props = $props();

  function close() {
    open = false;
    onclose?.();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="m-overlay" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
    <div class="m-modal" class:m-modal--lg={size === 'lg'} role="dialog" aria-modal="true">
      {#if title}
        <header class="m-modal__header">
          <span>{title}</span>
          <button class="m-btn m-btn--ghost m-btn--icon" aria-label="Close" onclick={close}>✕</button>
        </header>
      {/if}
      <div class="m-modal__body">{@render children()}</div>
      {#if footer}<footer class="m-modal__footer">{@render footer()}</footer>{/if}
    </div>
  </div>
{/if}
