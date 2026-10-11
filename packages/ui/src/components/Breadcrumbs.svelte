<script lang="ts">
  interface Crumb {
    label: string;
    href?: string;
  }

  interface Props {
    items: Crumb[];
  }

  let { items }: Props = $props();
</script>

<nav class="m-breadcrumbs" aria-label="Breadcrumb">
  {#each items as crumb, i (crumb.label)}
    {#if i > 0}<span style="opacity:.4">/</span>{/if}
    {#if crumb.href}
      <a href={crumb.href}>{crumb.label}</a>
    {:else}
      <strong>{crumb.label}</strong>
    {/if}
  {/each}
</nav>
