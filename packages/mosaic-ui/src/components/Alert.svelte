<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    variant?: 'info' | 'success' | 'warning' | 'danger';
    title?: string;
    text?: string;
  }

  let { variant = 'info', title, text }: Props = $props();

  const iconName = $derived(variant === 'success' ? 'check' : variant === 'warning' ? 'alertTriangle' : variant === 'danger' ? 'x' : 'info');
</script>

<div class="m-alert m-alert--{variant}" role={variant === 'danger' ? 'alert' : 'status'}>
  <Icon name={iconName} size={16} />
  <div>
    {#if title}<strong style="display:block">{title}</strong>{/if}
    {#if text}<span class="m-small">{text}</span>{/if}
  </div>
</div>
