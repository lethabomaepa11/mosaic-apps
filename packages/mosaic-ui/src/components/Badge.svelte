<script lang="ts">
  interface Props {
    text?: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
    color?: string;
  }

  let { text, variant = 'default', color }: Props = $props();
</script>

{#if color}
  <span class="m-badge" style="background:{color}1a;color:{color};border-color:transparent">{text}</span>
{:else}
  <span class="m-badge" class:m-badge--primary={variant === 'primary'} class:m-badge--success={variant === 'success'}
    class:m-badge--warning={variant === 'warning'} class:m-badge--danger={variant === 'danger'}
    class:m-badge--info={variant === 'info'} class:m-badge--outline={variant === 'outline'}>{text}</span>
{/if}
