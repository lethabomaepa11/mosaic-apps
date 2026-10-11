<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    steps: string[];
    current?: number;
  }

  let { steps, current = 0 }: Props = $props();
</script>

<nav class="m-steps" aria-label="Progress">
  {#each steps as label, i (label)}
    <div class="m-steps__step" class:active={i === current} class:done={i < current}>
      <span class="m-steps__num">
        {#if i < current}
          <Icon name="check" size={14} />
        {:else}
          {i + 1}
        {/if}
      </span>
      <span>{label}</span>
      {#if i < steps.length - 1}<Icon name="chevronRight" size={12} style="opacity:.35;margin:0 6px" />{/if}
    </div>
  {/each}
</nav>
