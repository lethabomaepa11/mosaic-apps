<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open?: boolean;
    title?: string;
    side?: 'left' | 'right';
    onclose?: () => void;
    footer?: Snippet;
    children: Snippet;
  }

  let { open = $bindable(false), title, side = 'right', onclose, footer, children }: Props = $props();

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
  <div class="m-drawer-overlay" onclick={(e) => { if (e.target === e.currentTarget) close(); }}></div>
  <aside class="m-drawer" class:m-drawer--left={side === 'left'} role="dialog" aria-modal="true">
    <header class="m-drawer__header">
      <span>{title}</span>
      <button class="m-btn m-btn--ghost m-btn--icon" aria-label="Close" onclick={close}>✕</button>
    </header>
    <div class="m-drawer__body">{@render children()}</div>
    {#if footer}<footer class="m-panel__footer">{@render footer()}</footer>{/if}
  </aside>
{/if}
