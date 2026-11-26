<script>
  import DateTimeControl from './DateTimeControl.svelte';
  import { Calendar } from './original-components.js';

  let { withTime = false, ...props } = $props();
</script>

{#if withTime}
  <DateTimeControl {...props} />
{:else}
  <Calendar {...props} />
{/if}
