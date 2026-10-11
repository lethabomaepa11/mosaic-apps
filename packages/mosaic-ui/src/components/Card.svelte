<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    actions?: Snippet;
    footer?: Snippet;
    children: Snippet;
    flush?: boolean;
  }

  let { title, subtitle, actions, footer, children, flush }: Props = $props();
</script>

<div class="m-card" class:m-card--flush={flush}>
  {#if title || actions}
    <div class="m-card__header">
      <div>
        {#if title}<h3 class="m-card__title">{title}</h3>{/if}
        {#if subtitle}<div class="m-small m-muted">{subtitle}</div>{/if}
      </div>
      {#if actions}<div class="m-row">{@render actions()}</div>{/if}
    </div>
  {/if}
  {@render children()}
  {#if footer}<div style="padding:0 var(--m-space-4) var(--m-space-4)">{@render footer()}</div>{/if}
</div>
