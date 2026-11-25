<script lang="ts">
  import { mapSource } from '../lib/map-source';
  let { provider = 'openstreetmap', title = 'Location map', latitude, longitude, mapboxToken }: {
    provider?: string; title?: string; latitude?: number; longitude?: number; mapboxToken?: string;
  } = $props();
  const source = $derived(mapSource({ provider, latitude, longitude, mapboxToken }));
</script>

{#if source?.kind === 'embed'}
  <iframe class="m-location-map" {title} src={source.url} loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
{:else if source?.kind === 'image'}
  <img class="m-location-map" alt={title} src={source.url} loading="lazy" referrerpolicy="strict-origin-when-cross-origin" />
{:else}
  <p class="m-muted">Choose a map provider and enter valid coordinates. Mapbox also requires a public token.</p>
{/if}

<style>
  .m-location-map { display:block; width:100%; min-height:200px; aspect-ratio:2; border:0; object-fit:cover; border-radius:var(--m-radius); }
</style>
