<script lang="ts">
  import ShadcnBadge from '../shadcn/badge/Badge.svelte';
  interface Props {
    text?: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
    color?: string;
  }

  let { text, variant = 'default', color }: Props = $props();
</script>

<ShadcnBadge class={`m-badge${variant !== 'default' ? ` m-badge--${variant}` : ''}`} variant={variant === 'primary' ? 'default' : variant === 'danger' ? 'destructive' : variant} style={color ? `background:${color}1a;color:${color};border-color:transparent` : undefined}>
  {#snippet children()}{text}{/snippet}
</ShadcnBadge>
