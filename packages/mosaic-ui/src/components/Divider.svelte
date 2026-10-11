<script lang="ts">
  import ShadcnSeparator from '../shadcn/separator/Separator.svelte';
  interface Props {
    // no props - simple divider
  }

  let {}: Props = $props();
</script>

<ShadcnSeparator class="m-divider" />
