<script lang="ts">
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
  }

  let { class: className, ...restProps }: Props = $props();

  const classes = $derived(cn('-mx-1 my-1 h-px bg-muted', className));
</script>

<BitsDropdownMenu.Separator class={classes} {...restProps} />