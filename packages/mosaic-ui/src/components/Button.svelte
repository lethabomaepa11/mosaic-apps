<script lang="ts">
  import type { Snippet } from 'svelte';
  import ShadcnButton from '../shadcn/button/Button.svelte';

  interface Props {
    label?: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    icon?: boolean;
    block?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    label = 'Button',
    variant = 'primary',
    size = 'md',
    icon,
    block,
    disabled,
    type = 'button',
    onclick,
    children,
  }: Props = $props();

  const classes = $derived([
    'm-btn',
    variant === 'primary' ? 'm-btn--primary' : '',
    variant === 'secondary' ? 'm-btn--secondary' : '',
    variant === 'ghost' ? 'm-btn--ghost' : '',
    variant === 'danger' ? 'm-btn--danger' : '',
    size === 'sm' ? 'm-btn--sm' : '',
    size === 'lg' ? 'm-btn--lg' : '',
    icon ? 'm-btn--icon' : '',
    block ? 'm-btn--block' : '',
  ].filter(Boolean).join(' '));

  const shadcnVariant = $derived(variant === 'danger' ? 'destructive' : variant === 'primary' ? 'default' : variant);
  const shadcnSize = $derived(size === 'md' ? 'default' : size);
</script>

<ShadcnButton class={classes} variant={shadcnVariant} size={shadcnSize} {type} {disabled} {onclick}>
  {#if children}{@render children()}{:else}{label}{/if}
</ShadcnButton>
