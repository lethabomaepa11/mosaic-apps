<script lang="ts">
  interface Props {
    variant?: 'info' | 'success' | 'warning' | 'danger';
    title?: string;
    text?: string;
  }

  let { variant = 'info', title, text }: Props = $props();

  const icon = $derived(variant === 'success' ? '✓' : variant === 'warning' ? '⚠' : variant === 'danger' ? '✕' : 'ℹ');
</script>

<div class="m-alert m-alert--{variant}" role={variant === 'danger' ? 'alert' : 'status'}>
  <span>{icon}</span>
  <div>
    {#if title}<strong style="display:block">{title}</strong>{/if}
    {#if text}<span class="m-small">{text}</span>{/if}
  </div>
</div>
