<script lang="ts">
  interface Props {
    text: string;
    level?: 1 | 2 | 3 | 4;
    muted?: boolean;
  }

  let { text, level = 1, muted }: Props = $props();

  const tag = $derived(level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4');
</script>

{#if tag === 'h1'}
  <h1 class="m-h1" class:m-muted={muted}>{text}</h1>
{:else if tag === 'h2'}
  <h2 class="m-h2" class:m-muted={muted}>{text}</h2>
{:else if tag === 'h3'}
  <h3 class="m-h3" class:m-muted={muted}>{text}</h3>
{:else}
  <h4 class="m-h4" class:m-muted={muted}>{text}</h4>
{/if}
