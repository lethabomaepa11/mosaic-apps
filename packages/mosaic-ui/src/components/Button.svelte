<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    icon?: boolean;
    block?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let {
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
</script>

<button class={classes} {type} {disabled} {onclick}>
  {@render children()}
</button>
