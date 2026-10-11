<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tooltip as BitsTooltip } from 'bits-ui';

  interface Props {
    text: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    children?: Snippet;
  }

  let { text, side = 'top', children }: Props = $props();
</script>

{#snippet triggerChild({ props }: { props: Record<string, unknown> })}
  <span class="m-tooltip__trigger" role="button" tabindex="0" {...props}>
    {#if children}{@render children()}{:else}<span aria-hidden="true">?</span>{/if}
  </span>
{/snippet}

<BitsTooltip.Provider>
  <BitsTooltip.Root>
    <BitsTooltip.Trigger child={triggerChild} />
    <BitsTooltip.Content {side} align="center" sideOffset={5}>
      <div class="m-tooltip__bubble" role="tooltip">{text}</div>
    </BitsTooltip.Content>
  </BitsTooltip.Root>
</BitsTooltip.Provider>
