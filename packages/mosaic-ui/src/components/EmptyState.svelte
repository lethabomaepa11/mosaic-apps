<script lang="ts">
  interface Props {
    icon?: string;
    title?: string;
    text?: string;
    children?: import('svelte').Snippet;
  }

  let { icon = '📭', title, text, children }: Props = $props();
</script>

<div class="m-empty">
  <div class="m-empty__icon">{icon}</div>
  {#if title}<strong>{title}</strong>{/if}
  {#if text}<div class="m-small m-muted" style="margin-top:4px">{text}</div>{/if}
  {#if children}<div style="margin-top:var(--m-space-3)">{@render children()}</div>{/if}
</div>
