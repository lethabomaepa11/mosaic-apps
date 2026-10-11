<script lang="ts">
  import SonnerToaster from '../shadcn/toaster/Toaster.svelte';

  interface Props {
    theme?: 'light' | 'dark' | 'system';
  }

  let { theme = 'system' }: Props = $props();
</script>

<SonnerToaster {theme} />
