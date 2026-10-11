<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Avatar as BitsAvatar } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    src?: string;
    alt?: string;
    fallbackClass?: string;
    style?: string;
    title?: string;
    ariaLabel?: string;
    id?: string;
    children?: Snippet;
  }

  let { class: className, fallbackClass, src, alt, children, style, title, ariaLabel, id }: Props = $props();

  const classes = $derived(cn(
    'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
    className
  ));
</script>

<BitsAvatar.Root class={classes} {style} {title} {id} aria-label={ariaLabel}>
  <BitsAvatar.Image {src} {alt} class="aspect-square h-full w-full" />
  <BitsAvatar.Fallback class={cn('flex h-full w-full items-center justify-center rounded-full bg-muted', fallbackClass)}>
    {@render children?.()}
  </BitsAvatar.Fallback>
</BitsAvatar.Root>
