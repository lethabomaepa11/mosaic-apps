<script lang="ts">
  import { Separator as BitsSeparator } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    orientation?: 'horizontal' | 'vertical';
    decorative?: boolean;
  }

  let { class: className, orientation = 'horizontal', decorative = true, ...restProps }: Props = $props();

  const classes = $derived(cn(
    'shrink-0 bg-border',
    orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
    className
  ));
</script>

<BitsSeparator.Root class={classes} {orientation} {decorative} {...restProps} />