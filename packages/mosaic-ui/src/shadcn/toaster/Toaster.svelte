<script lang="ts">
  import { Toaster as SonnerToaster, toast } from 'svelte-sonner';

  interface Props {
    class?: string;
    theme?: 'light' | 'dark' | 'system';
  }

  let { class: className, theme = 'system', ...restProps }: Props = $props();
</script>

<SonnerToaster {theme} class={className} {...restProps} />