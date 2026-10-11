<script lang="ts">
  import { Select as BitsSelect } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    placeholder?: string;
  }

  let { class: className, placeholder, ...restProps }: Props = $props();

  const classes = $derived(cn('flex items-center', className));
</script>

<BitsSelect.Value class={classes} {placeholder} {...restProps} />