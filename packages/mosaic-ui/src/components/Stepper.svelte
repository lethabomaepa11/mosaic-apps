<script lang="ts">
  interface Props {
    steps: string[];
    current?: number;
  }

  let { steps, current = 0 }: Props = $props();
</script>

<nav class="m-steps" aria-label="Progress">
  {#each steps as label, i (label)}
    <div class="m-steps__step" class:active={i === current} class:done={i < current}>
      <span class="m-steps__num">{i < current ? '✓' : i + 1}</span>
      <span>{label}</span>
      {#if i < steps.length - 1}<span style="opacity:.35;margin:0 6px">→</span>{/if}
    </div>
  {/each}
</nav>
