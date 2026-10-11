<script lang="ts">
  interface Props {
    src?: string;
    alt?: string;
    width?: string;
    height?: string;
    fit?: 'cover' | 'contain' | 'fill' | 'none';
    href?: string;
    caption?: string;
  }
  let { src = '', alt = '', width = '100%', height = 'auto', fit = 'cover', href = '', caption = '' }: Props = $props();
  const safeHref = $derived(/^(https?:\/\/|\/|#|\?|\.\/|\.\.\/)/i.test(href) ? href : '');
</script>

{#if src}
  <figure class="m-image">
    {#if safeHref}
      <a href={safeHref} aria-label={alt || caption || 'Open image'}><img {src} {alt} style={`width:${width};height:${height};object-fit:${fit}`} loading="lazy" /></a>
    {:else}
      <img {src} {alt} style={`width:${width};height:${height};object-fit:${fit}`} loading="lazy" />
    {/if}
    {#if caption}<figcaption>{caption}</figcaption>{/if}
  </figure>
{:else}
  <div class="m-image__empty" role="img" aria-label="Image source is not configured">Add an image URL in component properties.</div>
{/if}

<style>
  .m-image { margin: 0; max-width: 100%; }
  .m-image img { display: block; max-width: 100%; border-radius: var(--m-radius); }
  .m-image figcaption { margin-top: 6px; color: var(--m-muted-foreground); font-size: .875rem; }
  .m-image__empty { display: grid; place-items: center; min-height: 120px; border: 1px dashed var(--m-border); border-radius: var(--m-radius); color: var(--m-muted-foreground); font-size: .875rem; }
</style>
