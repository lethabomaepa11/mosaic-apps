<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    toolbar?: Snippet;
    children?: Snippet;
    footer?: Snippet;
  }

  let { title, subtitle, toolbar, children, footer }: Props = $props();
</script>

<section class="m-card m-card--flush">
  {#if title}
    <header class="m-panel__header">
      <div>
        <h3 class="m-card__title">{title}</h3>
        {#if subtitle}<div class="m-small m-muted">{subtitle}</div>{/if}
      </div>
      {#if toolbar}<div class="m-row">{@render toolbar()}</div>{/if}
    </header>
  {/if}
  <div class="m-panel__body">{@render children?.()}</div>
  {#if footer}<footer class="m-panel__footer">{@render footer()}</footer>{/if}
</section>
