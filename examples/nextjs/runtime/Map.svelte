<script>
  import { mapSource } from '../lib/map.js';
  let { title = 'Location map', ...props } = $props();
  const source = $derived(mapSource(props));
</script>

{#if source?.kind === 'frame'}
  <iframe class="location-map" {title} src={source.url} loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
{:else if source?.kind === 'image'}
  <img class="location-map" alt={title} src={source.url} loading="lazy" referrerpolicy="strict-origin-when-cross-origin" />
{:else}
  <p>Choose a map provider and enter valid coordinates. Mapbox also requires a public token.</p>
{/if}

<style>
  .location-map { display:block; width:100%; min-height:200px; aspect-ratio:2; border:0; object-fit:cover; border-radius:.75rem; }
</style>
