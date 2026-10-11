<script lang="ts">
  import { Avatar as BitsAvatar } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    src?: string;
    alt?: string;
  }

  let { class: className, src, alt, ...restProps }: Props = $props();

  const classes = $derived(cn('aspect-square h-full w-full', className));
</script>

<BitsAvatar.Image {src} {alt} class={classes} {...restProps} />