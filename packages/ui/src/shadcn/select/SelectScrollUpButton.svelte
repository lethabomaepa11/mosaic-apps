<script lang="ts">
  import { Select as BitsSelect } from 'bits-ui';
  import { cn } from '../../lib/cn';
  import { ChevronUp } from '@lucide/svelte';

  interface Props {
    class?: string;
  }

  let { class: className, ...restProps }: Props = $props();

  const classes = $derived(cn('flex h-4 items-center justify-center', className));
</script>

<BitsSelect.ScrollUpButton class={classes} {...restProps}>
  <ChevronUp class="h-4 w-4" />
</BitsSelect.ScrollUpButton>